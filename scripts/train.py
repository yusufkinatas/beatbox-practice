# Trains the identity model (PLAN.md decision 4) on data/avp/features.json (scripts/avp-features.ts) and exports src/judge/model.json.
# Run from the project root: python3 -P -E scripts/train.py   (not -I: scikit-learn lives in the user site here)
import json
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.neural_network import MLPClassifier
from sklearn.utils.class_weight import compute_sample_weight

CLASSES = ['B', 't', 'K']
T_LIKE = {'t', 'ts', 'tʃ', 'tɕ'}   # alveolar / postalveolar onsets; 'p', 'kg', 's' hats are left out
K_LIKE = {'k', 'kg'}              # velar snares; the rest are 't', 'tʃ', 'pf', clicks...
UNSURE, KEEP = 0.6, 0.99          # judge's unsureProb; share of held-out hits inside noneDist
MLP_MARGIN = 0.02                 # the MLP must beat logistic regression by this much balanced accuracy


def label(r, open_hats):
    # Fixed subset: everyone said "pm" (kick), "ta" (snare), "ti" (closed hat), "chi" (open hat), Delgado 2019. No phoneme labels there.
    fixed, l, p = r['subset'] == 'Fixed', r['label'], r['phon']
    if l == 'kd' and (fixed or p == 'p'): return 0
    if (l == 'hhc' or (open_hats and l == 'hho')) and (fixed or p in T_LIKE): return 1
    if l == 'sd' and not fixed and p in K_LIKE: return 2
    return -1


def fit(kind, X, y):
    mean, sd = X.mean(0), X.std(0)
    sd[sd == 0] = 1
    Z = (X - mean) / sd
    w = compute_sample_weight('balanced', y)
    if kind[0] == 'lr': clf = LogisticRegression(C=kind[1], max_iter=5000)
    else: clf = MLPClassifier((kind[1],), alpha=kind[2], solver='lbfgs', max_iter=5000, random_state=0)
    clf.fit(Z, y, sample_weight=w)
    cen = np.array([Z[y == k].mean(0) for k in range(3)])
    spr = np.array([np.maximum(Z[y == k].std(0), 1e-3) for k in range(3)])
    return dict(mean=mean, sd=sd, clf=clf, cen=cen, spr=spr)


def run(m, X):
    Z = (X - m['mean']) / m['sd']
    p = m['clf'].predict_proba(Z)
    d = np.sqrt((((Z[:, None, :] - m['cen'][None]) / m['spr'][None]) ** 2).mean(2)).min(1)
    return p, d


def cv(kind, X, y, g, train_mask):
    P, D = np.zeros((len(X), 3)), np.zeros(len(X))
    for tr, te in GroupKFold(7).split(X, groups=g):
        tr = tr[train_mask[tr]]
        m = fit(kind, X[tr], y[tr])
        P[te], D[te] = run(m, X[te])
    return P, D


def scores(P, y):
    pred, conf = P.argmax(1), P.max(1)
    rec = [float((pred[y == k] == k).mean()) for k in range(3)]
    return dict(acc=float((pred == y).mean()), bal=float(np.mean(rec)), rec=rec, unsure=float((conf < UNSURE).mean()),
                cm=[[int(((y == a) & (pred == b)).sum()) for b in range(3)] for a in range(3)])


def r5(a): return [r5(v) for v in a] if isinstance(a, (list, np.ndarray)) else float(f'{a:.5g}')


rows = json.load(open('data/avp/features.json'))
X = np.array([r['features'] for r in rows], dtype=float)
g = np.array([r['participant'] for r in rows])
y_closed = np.array([label(r, False) for r in rows])
y_open = np.array([label(r, True) for r in rows])
ev = y_closed >= 0                                    # every comparison is scored on B, closed-hat t and K-like snares
hho = (y_open == 1) & (y_closed < 0)                  # open hats that would count as t

print(f'rows {len(rows)}, features {X.shape[1]}; labelled B {(y_closed == 0).sum()}, t (closed) {(y_closed == 1).sum()}, '
    f'K {(y_closed == 2).sum()}, open hats usable as t {hho.sum()}; K-like snares from {len(set(g[y_closed == 2]))} participants')

# 1. Model family and size, leave-participants-out, closed hats only.
kinds = [('lr', c) for c in (0.03, 0.3, 3)] + [('mlp', h, a) for h in (8, 16, 32) for a in (0.1, 1, 10)]
res = {}
print('\n| model | balanced acc | acc | B | t | K | unsure |\n|---|---|---|---|---|---|---|')
for k in kinds:
    P, D = cv(k, X, y_closed, g, ev)
    s = res[k] = scores(P[ev], y_closed[ev])
    print(f"| {k} | {s['bal']:.3f} | {s['acc']:.3f} | {s['rec'][0]:.3f} | {s['rec'][1]:.3f} | {s['rec'][2]:.3f} | {s['unsure']:.3f} |")
best_lr = max((k for k in kinds if k[0] == 'lr'), key=lambda k: res[k]['bal'])
best_mlp = max((k for k in kinds if k[0] == 'mlp'), key=lambda k: res[k]['bal'])
kind = best_mlp if res[best_mlp]['bal'] >= res[best_lr]['bal'] + MLP_MARGIN else best_lr
print(f'\nbest LR {best_lr}, best MLP {best_mlp}: chose {kind}')

# 2. Open hats as t: same held-out B / closed t / K scoring, plus how often a held-out open hat is called t.
for name, y, mask in (('closed hats only', y_closed, ev), ('closed + open hats', y_open, y_open >= 0)):
    P, D = cv(kind, X, y, g, mask)
    s = scores(P[ev], y_closed[ev])
    print(f"{name}: balanced acc {s['bal']:.3f}, unsure {s['unsure']:.3f}, held-out open hats called t {(P[hho].argmax(1) == 1).mean():.3f}")
    if name.startswith('closed +'): with_open = (s, P, D)
    else: without = (s, P, D)
use_open = with_open[0]['bal'] >= without[0]['bal'] - 0.005
y, train_mask = (y_open, y_open >= 0) if use_open else (y_closed, ev)
s, P, D = with_open if use_open else without
print(f'open hats as t: {"yes" if use_open else "no"}')

# 3. Held-out report for the chosen setup, and noneDist from held-out distances.
lab = y >= 0
none_dist = float(np.quantile(D[lab], KEEP))
s_all = scores(P[lab], y[lab])
veto = json.load(open('src/judge/config.json'))['vetoes']['B']
print(f"\nheld-out (leave-participants-out, 7 folds), scored on B / closed t / K: acc {s['acc']:.3f}, balanced {s['bal']:.3f}, "
    f"recall B {s['rec'][0]:.3f} t {s['rec'][1]:.3f} K {s['rec'][2]:.3f}, unsure at {UNSURE}: {s['unsure']:.3f}")
print(f"held-out on every training row (incl. open hats if used): acc {s_all['acc']:.3f}, unsure {s_all['unsure']:.3f}")
print('confusion (rows true B,t,K; cols predicted B,t,K): ' + json.dumps(s['cm']))
print(f'noneDist {none_dist:.3f} ({KEEP:.0%} of held-out labelled hits inside); hits past it: {(D[lab] > none_dist).mean():.3f}')
for name, mask in (('Fixed "ta" snares', np.array([r['label'] == 'sd' and r['subset'] == 'Fixed' for r in rows])),
                   ('spit "p" snares', np.array([r['label'] == 'sd' and r['phon'] == 'p' for r in rows])),
                   ('alveolar Personal snares (t, ts, tʃ, tɕ)', np.array([r['label'] == 'sd' and r['phon'] in T_LIKE for r in rows])),
                   ('click snares (!)', np.array([r['label'] == 'sd' and r['phon'] == '!' for r in rows])),
                   ('non-bilabial kicks', np.array([r['label'] == 'kd' and r['subset'] == 'Personal' and r['phon'] != 'p' for r in rows]))):
    pr = P[mask].argmax(1)
    vetoB = np.array([rows[i]['m'][veto['measure']] < veto['min'] for i in np.where(mask)[0]])
    print(f"left-out {name} ({mask.sum()}): held-out called B {(pr == 0).mean():.2f} t {(pr == 1).mean():.2f} K {(pr == 2).mean():.2f}, "
        f"none (past noneDist) {(D[mask] > none_dist).mean():.2f}; B veto fires on {vetoB[pr == 0].mean() if (pr == 0).any() else 0:.2f} of those called B")

# 4. Final model on every participant.
m = fit(kind, X[train_mask], y[train_mask])
c = m['clf']
layers = [dict(W=r5(c.coef_), b=r5(c.intercept_))] if kind[0] == 'lr' else \
    [dict(W=r5(W.T), b=r5(b)) for W, b in zip(c.coefs_, c.intercepts_)]
model = dict(classes=CLASSES, mean=r5(m['mean']), sd=r5(m['sd']), layers=layers, centroids=r5(m['cen']), spread=r5(m['spr']),
             noneDist=r5(none_dist), info=dict(
                 kind=f'logistic regression, C {kind[1]}' if kind[0] == 'lr' else f'MLP, {kind[1]} ReLU units, alpha {kind[2]}',
                 trainedOn=f'AVP, {int(train_mask.sum())} hits, 28 participants', features=X.shape[1],
                 labels='B: kicks ("p" or Fixed "pm"); t: closed hats (t-like or Fixed "ti")' + (' + open hats' if use_open else '') + '; K: velar snares (k, kg)',
                 heldOut=dict(acc=r5(s['acc']), balanced=r5(s['bal']), recall=dict(zip(CLASSES, r5(s['rec']))), unsure=r5(s['unsure']))))
text = json.dumps(model, separators=(',', ':'))
open('src/judge/model.json', 'w').write(text)
Pf, Df = run(m, X)
json.dump([dict(p=p.tolist(), dist=float(d)) for p, d in zip(Pf, Df)], open('data/avp/sk-pred.json', 'w'))
print(f'\nmodel.json {len(text) / 1024:.1f} KB, trained on {int(train_mask.sum())} hits; training-set acc {(Pf[train_mask].argmax(1) == y[train_mask]).mean():.3f}')
