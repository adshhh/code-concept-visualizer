def binary_search(nums, target):
    low = 0
    high = len(nums) - 1
    while low < high:
        mid = (low + high) // 2
        if nums[mid] < target:
            low = mid + 1
        else:
            high = mid
    return low
print(binary_search([2, 4, 6, 8, 10], 8))
