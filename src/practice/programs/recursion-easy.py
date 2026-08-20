def show(n):
    if n > 0:
        print(n)
        show(n - 1)
show(3)
