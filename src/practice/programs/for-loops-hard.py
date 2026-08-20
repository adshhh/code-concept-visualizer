grid = [[1, 2], [3, 4], [5, 6]]
total = 0
for row in grid:
    for cell in row:
        total = total + cell
    print(total)
print(total)
