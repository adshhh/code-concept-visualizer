def binary_search(nums, target, low, high):
    if low > high:
        return -1
    mid = (low + high) // 2
    if nums[mid] == target:
        return mid
    elif nums[mid] < target:
        return binary_search(nums, target, mid + 1, high)
    else:
        return binary_search(nums, target, low, mid - 1)
print(binary_search([1, 3, 5, 7, 9], 7, 0, 4))
