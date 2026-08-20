nums = [5, 1, 6, 2, 7, 3]
total = 0
for i in range(len(nums)):
    if i % 2 == 0:
        total = total + nums[i]
print(total)
