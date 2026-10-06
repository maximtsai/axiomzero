function getCost(level, baseCost, costStep, costStepScaling) {
    const scalingBonus = (level * (level + 1)) / 2 * costStepScaling;
    return baseCost + (costStep * level) + scalingBonus;
}

console.log("--- Test: Base 4, Step 4, Scaling 2 ---");
console.log("Level 0 cost:", getCost(0, 4, 4, 2)); // Expected 4
console.log("Level 1 cost:", getCost(1, 4, 4, 2)); // Expected 10
console.log("Level 2 cost:", getCost(2, 4, 4, 2)); // Expected 18

console.log("\n--- Test: Linear Fallback (Scaling 0) ---");
console.log("Level 0 cost:", getCost(0, 5, 5, 0)); // Expected 5
console.log("Level 1 cost:", getCost(1, 5, 5, 0)); // Expected 10
console.log("Level 2 cost:", getCost(2, 5, 5, 0)); // Expected 15
