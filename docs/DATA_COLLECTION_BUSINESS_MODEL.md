# Data Collection Business Model

## Concept

FleetMind Studio treats each AMR simulation run as a reusable synthetic data asset.

The system does not only visualize robot motion. It also records each episode as structured data containing:

- AMR identity
- task assignment
- agent decision
- start and goal cells
- trajectory
- reservation log
- collision / edge-swap summary
- duration
- success status

This turns simulation into a repeatable data-generation pipeline.

## Target Users

| User | Need |
|---|---|
| Factory automation teams | Test layout changes before deployment |
| AMR solution companies | Validate fleet logic without hardware |
| Robotics AI teams | Generate synthetic trajectory and conflict data |
| SI / consulting teams | Compare automation scenarios for clients |

## Value Proposition

FleetMind Studio provides three business values:

1. **Lower PoC cost**
   - Layout and fleet logic can be tested before physical deployment.

2. **Reusable synthetic data**
   - Each scenario generates structured JSON records that can be used for analysis, reporting, or model training.

3. **Explainable fleet behavior**
   - Agent decisions, reservation events, and arbiter results make the simulation auditable.

## Data Product Structure

| Output | Business Use |
|---|---|
| Episode JSON | Fleet behavior analysis |
| Reservation log | Bottleneck and conflict diagnosis |
| Snapshot PNG | Scenario reporting |
| Validation result | Dataset quality control |
| Replay | Client-facing demonstration |

## Expansion Path

1. Web 2D simulation studio
2. Scenario dataset library
3. 3D / digital twin viewer
4. Physical robot validation
5. SaaS dashboard for factory and logistics automation

## Why This Matters

A single AMR movement is not the product.  
The product is the accumulated dataset of how fleets behave across layouts, tasks, conflicts, and constraints.

FleetMind Studio demonstrates the first stage of this pipeline.
