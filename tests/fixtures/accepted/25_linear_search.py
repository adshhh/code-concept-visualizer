def linear_search(nums, target):
    for i in range(len(nums)):
        if nums[i] == target:
            return i
    return -1


nums = [4, 2, 7, 1, 9, 3]
print(linear_search(nums, 7))
print(linear_search(nums, 100))
