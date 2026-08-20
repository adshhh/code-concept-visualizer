def half(n):
    return n // 2
def shrink(nums):
    for i in range(len(nums)):
        nums[i] = half(nums[i])
    return nums
print(shrink([8, 12, 20]))
