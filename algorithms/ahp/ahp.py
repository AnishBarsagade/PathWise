CRITERIA = [
    "Distance",
    "Travel Time",
    "Traffic",
    "Fuel Cost",
    "Weather",
    "Road Condition",
]


# Pairwise comparison matrix
# The matrix follows the Saaty 1-9 scale.
# matrix[i][j] represents how much more important
# criterion i is compared with criterion j.
#
# The matrix is reciprocal:
# matrix[i][j] = 1 / matrix[j][i]

COMPARISON_MATRIX = [
    [1,    1,    2,    3,    4,    4],
    [1,    1,    2,    2,    3,    4],
    [1/2,  1/2,  1,    2,    2,    3],
    [1/3,  1/2,  1/2,  1,    2,    2],
    [1/4,  1/3,  1/2,  1/2,  1,    1],
    [1/4,  1/4,  1/3,  1/2,  1,    1],
]


def normalize_matrix(matrix):
    """
    Normalize each column of the pairwise comparison matrix.
    """
    number_of_rows = len(matrix)
    number_of_columns = len(matrix[0])

    column_sums = []

    for column in range(number_of_columns):
        total = sum(matrix[row][column] for row in range(number_of_rows))
        column_sums.append(total)

    normalized = []

    for row in range(number_of_rows):
        normalized_row = []

        for column in range(number_of_columns):
            value = matrix[row][column] / column_sums[column]
            normalized_row.append(value)

        normalized.append(normalized_row)

    return normalized


def calculate_weights(matrix):
    """
    Calculate AHP priority weights by:
    1. Normalizing the matrix.
    2. Taking the average of each row.
    """
    normalized = normalize_matrix(matrix)

    weights = []

    for row in normalized:
        row_average = sum(row) / len(row)
        weights.append(row_average)

    return weights


def calculate_lambda_max(matrix, weights):
    """
    Calculate lambda max for the consistency calculation.
    """
    weighted_sum = []

    for row in matrix:
        total = sum(
            row[index] * weights[index]
            for index in range(len(weights))
        )
        weighted_sum.append(total)

    lambda_values = []

    for index in range(len(weights)):
        lambda_values.append(
            weighted_sum[index] / weights[index]
        )

    return sum(lambda_values) / len(lambda_values)


def calculate_consistency_ratio(matrix, weights):
    """
    Calculate:
    CI = (lambda_max - n) / (n - 1)
    CR = CI / RI

    For 6 criteria, RI = 1.24.
    """
    n = len(matrix)

    lambda_max = calculate_lambda_max(matrix, weights)

    consistency_index = (
        (lambda_max - n) / (n - 1)
    )

    # Random Index for a 6 x 6 matrix
    random_index = 1.24

    consistency_ratio = (
        consistency_index / random_index
    )

    return consistency_ratio


def calculate_ahp_weights():
    """
    Calculate the final AHP weights and consistency ratio.
    """
    weights = calculate_weights(COMPARISON_MATRIX)

    consistency_ratio = calculate_consistency_ratio(
        COMPARISON_MATRIX,
        weights
    )

    return weights, consistency_ratio


def main():
    weights, consistency_ratio = calculate_ahp_weights()

    print("AHP Weights")
    print("-" * 30)

    for criterion, weight in zip(CRITERIA, weights):
        print(f"{criterion}: {weight:.2f}")

    print("-" * 30)
    print(f"Total Weight: {sum(weights):.2f}")

    print(f"Consistency Ratio: {consistency_ratio:.2f}")

    if consistency_ratio < 0.10:
        print("Consistency: Acceptable")
    else:
        print("Consistency: Not Acceptable")


if __name__ == "__main__":
    main()