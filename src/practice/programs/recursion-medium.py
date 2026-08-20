def total(nums, i):
    if i == len(nums):
        return 0
    return nums[i] + total(nums, i + 1)
print(total([4, 5, 6], 0))
