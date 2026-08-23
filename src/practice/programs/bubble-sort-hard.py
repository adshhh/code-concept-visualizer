nums = [5, 3, 4, 1]
n = len(nums)
for i in range(n):
    swapped = False
    for j in range(n - i - 1):
        if nums[j] > nums[j + 1]:
            nums[j], nums[j + 1] = nums[j + 1], nums[j]
            swapped = True
    if not swapped:
        break
print(nums)
