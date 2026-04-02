# Upgrade Tree Layout Guide

This document defines the conventions for positioning nodes within the Upgrade Tree in `nodeDefs.js`.

## Coordinate System

- **Tree Center X**: `400`
- **Panel Width**: `800px` (Internal upgrade window coordinates)
- **Standard Grid Unit**: `80px`

## General Conventions

### Vertical Positioning (treeY)
Nodes are arranged in horizontal tiers that reflect their depth in the tree.
- **Root Level (Awaken)**: `750`
- **Level 1 (Core)**: `670`
- **Standard Step**: `-80` per vertical level (moving upwards as depth increases).

### Horizontal Positioning (treeX)
Horizontal placement follows a thematic separation of upgrade types:

- **Left Side (X < 400)**: **Defense, Utility, & Resource Management**
  - Upgrades like Tower Health (`Reinforce`), HP Regen (`Regen`), and Resource Pickup Range (`Attract`).
- **Right Side (X > 400)**: **Offense & Combat Power**
  - Upgrades like Basic Damage (`Sharpen`), Cursor Damage (`Amplify`), Attack Size (`Nova`), and Attack Range (`Influence`).
- **Standard X Step**: `80` (e.g., 400 -> 320 or 400 -> 480).

## Node Mapping Summary (Common Coordinates)

| Node Path | Coordinate (X, Y) | Category |
| :--- | :--- | :--- |
| **Awaken** (Root) | (400, 750) | Core |
| **Reinforce** | (320, 750) | Defense (Left) |
| **Sharpen** | (480, 750) | Offense (Right) |
| **Cognition** | (400, 670) | Core |
| **Attract** | (320, 670) | Utility (Left) |
| **Amplify** | (480, 670) | Offense (Right) |
| **Nova** | (560, 670) | Offense (Right) |
| **Overcharge** | (560, 590) | Offense (Right) |

## Layout Rules for New Nodes
1. **Maintain the 80px Grid**: Always use multiples of 80 for offsets from the parent or the center.
2. **Thematic Consistency**: Favor placing health/shield nodes on the left branch and damage/speed nodes on the right branch.
3. **Avoid Overlaps**: Ensure that children belonging to different branches do not occupy the same (X, Y) coordinate. Use `treeY` to separate nodes if they must share an `treeX`.
