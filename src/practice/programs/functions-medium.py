def bigger(a, b):
    if a > b:
        return a
    return b
for pair in [[3, 9], [8, 2]]:
    print(bigger(pair[0], pair[1]))
