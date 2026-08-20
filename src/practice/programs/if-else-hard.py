words = ["hi", "hello", "hey", "howdy"]
long = 0
for word in words:
    if len(word) > 3:
        long = long + 1
    else:
        print(word)
print(long)
