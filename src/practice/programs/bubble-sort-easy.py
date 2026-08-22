nums = [5, 3, 4, 1]
for j in range(len(nums) - 1):
    if nums[j] > nums[j + 1]:
        nums[j], nums[j + 1] = nums[j + 1], nums[j]
print(nums)
