names = ["ada", "alan", "grace"]
scores = [90, 70, 95]
best = 0
for i in range(len(scores)):
    if scores[i] > scores[best]:
        best = i
print(names[best], scores[best])
