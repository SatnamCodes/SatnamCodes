<div align="center">

<details>
<summary><a name="totem"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/totem-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/totem-light.svg"><img src="assets/totem-light.svg" width="840" alt="A steel spinning top, simulated from the equations of a heavy top and run on my last two weeks of work: spinning true when I have been building steadily, wobbling when I have not, at rest when I stop. Click it to open its blueprint."></picture></a><br><sub>Click the top for its blueprint and its other states</sub></summary>
<br>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/blueprint-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/blueprint-light.svg">
  <img src="assets/blueprint-light.svg" width="840" alt="The top's blueprint: an elevation with its lean, a plan view turning at the measured rate, and dimensions that are the readings: contributions in the last 14 days, the usual fortnight, steadiness and days since the last commit.">
</picture>
<br><br>
<sub>Today's state is above. The other two, from example fortnights:</sub>
<br><br>

<!-- states -->
<details>
<summary><a name="wobbling"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/states/wobbling-button-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/states/wobbling-button-light.svg"><img src="assets/states/wobbling-button-light.svg" height="40" alt="See it wobbling"></picture></a></summary>
<br>
<a name="wobbling-top"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/states/wobbling-top-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/states/wobbling-top-light.svg"><img src="assets/states/wobbling-top-light.svg" width="560" alt="The top wobbling, from an example fortnight."></picture></a>
<br>
<picture><source media="(prefers-color-scheme: dark)" srcset="assets/states/wobbling-blueprint-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/states/wobbling-blueprint-light.svg"><img src="assets/states/wobbling-blueprint-light.svg" width="840" alt="Its blueprint, wobbling: 3 contributions in 14 days, steadiness 0.3."></picture>
</details>
<details>
<summary><a name="at-rest"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/states/at-rest-button-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/states/at-rest-button-light.svg"><img src="assets/states/at-rest-button-light.svg" height="40" alt="See it at rest"></picture></a></summary>
<br>
<a name="at-rest-top"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/states/at-rest-top-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/states/at-rest-top-light.svg"><img src="assets/states/at-rest-top-light.svg" width="560" alt="The top at rest, from an example fortnight."></picture></a>
<br>
<picture><source media="(prefers-color-scheme: dark)" srcset="assets/states/at-rest-blueprint-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/states/at-rest-blueprint-light.svg"><img src="assets/states/at-rest-blueprint-light.svg" width="840" alt="Its blueprint, at rest: 0 contributions in 14 days, steadiness 0."></picture>
</details>
<!-- /states -->

</details>

<!-- totem -->
<sub><b>Spinning true</b> · 16 contributions in the last 14 days · measured 10 Oct 2026</sub>
<!-- /totem -->

</div>

<div align="center">

<picture><source media="(prefers-color-scheme: dark)" srcset="assets/title-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/title-light.svg"><img src="assets/title-light.svg" width="840" alt="Satnam Singh. I build models of physical systems, and the GPU code they run on. Machine learning engineering, AI infrastructure, AI research, software engineering."></picture>

</div>

I work where the equations meet the hardware. On one side, models of physical things: crystals, fluids, planets. On the other, the GPU code those models run on, measured until every number has an explanation.

- **AI infrastructure.** *Making the machine explain itself.* A CUDA SGEMM taken from a naive kernel through coalescing and shared-memory tiling, 169.6 → 1,052.9 GFLOPS on an RTX 4060 (6.5×), profiled in Nsight Systems and Nsight Compute; register blocking, warp tiling and Tensor Cores next. Warp divergence in the neighbour-gather step of a particle simulation, over a million particles.
- **AI research.** *Teaching a network the shape of a defect.* Graph neural networks over a defect's real crystal structure, predicting formation energies and ionization levels of p-type dopants in β-Ga₂O₃; abstract under review at IIM ATM 2026. An independent study asking whether exoplanet habitability indices reduce to a few physical quantities.
- **ML engineering.** *Models that survive contact with real data.* NodeGuard, a GCN in PyTorch Geometric that finds fraud rings under heavy class imbalance; recall-only checkpointing settled on a degenerate model, so it checkpoints on F1. A multi-agent retrieval system (LangGraph, FAISS) that checks every generated claim against its sources with sentence-level NLI.
- **Software engineering.** *A specification made queryable.* A pipeline that loads 1,700+ RISC-V YAML specification files into PostgreSQL: 8 tables, 1,351 instructions, 396 control and status registers. Python, C++, FastAPI, Docker, Linux.

**Education.** Indian Institute of Technology Madras, B.S. in Data Science and Applications (2025–2029). Delhi Public School, Bathinda.

<div align="center">

<br>

<a href="https://github.com/SatnamCodes/matmul"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/shots/sgemm-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/shots/sgemm-light.svg"><img src="assets/shots/sgemm-light.svg" width="410" alt="Custom SGEMM: matrix multiplication drawn as a room of three walls, tiles of C filling as strips of A and B light up. 169.6 to 1,052.9 GFLOPS on an RTX 4060."></picture></a>
<a href="https://satnamwanders.dev/research/p-type-dopants-in-beta-ga2o3"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/shots/dopants-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/shots/dopants-light.svg"><img src="assets/shots/dopants-light.svg" width="410" alt="p-type dopants in beta-Ga2O3: a crystal lattice turning under a lamp, one dopant glowing. Abstract under review at IIM ATM 2026."></picture></a>

<a href="https://github.com/SatnamCodes/gpu-neighbor-gather-divergence"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/shots/warp-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/shots/warp-light.svg"><img src="assets/shots/warp-light.svg" width="410" alt="Warp divergence: 32 lanes as rods, each lane's work a bead sliding down; with uneven work most wait for the slowest."></picture></a>
<a href="https://satnamwanders.dev/projects/nodeguard"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/shots/nodeguard-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/shots/nodeguard-light.svg"><img src="assets/shots/nodeguard-light.svg" width="410" alt="NodeGuard: a transaction graph in three dimensions, the camera circling it; the fraud ring is the warm knot."></picture></a>

<a href="https://satnamwanders.dev/projects/risc-v-knowledge-db"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/shots/riscv-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/shots/riscv-light.svg"><img src="assets/shots/riscv-light.svg" width="410" alt="RISC-V specification database: a split-flap board spelling out 32-bit instruction words, their fields bracketed beneath."></picture></a>
<a href="https://satnamwanders.dev"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/shots/exoplanets-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/shots/exoplanets-light.svg"><img src="assets/shots/exoplanets-light.svg" width="410" alt="Exoplanet habitability: a planet on an eccentric orbit transiting its star, the light curve dipping."></picture></a>

<br><br>

<picture><source media="(prefers-color-scheme: dark)" srcset="assets/city-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/city-light.svg"><img src="assets/city-light.svg" width="840" alt="The last year of contributions as a city, a block a day, as tall as that day's work; the past recedes into haze and the last fortnight is lit."></picture>

<details>
<summary><sub>See the year flat</sub></summary>
<br>
<picture><source media="(prefers-color-scheme: dark)" srcset="assets/heatmap-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/heatmap-light.svg"><img src="assets/heatmap-light.svg" width="840" alt="The same year as a flat calendar, a square a day, with the fortnight the top is measured on marked."></picture>
</details>

<br><br>

<picture><source media="(prefers-color-scheme: dark)" srcset="assets/kit-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/kit-light.svg"><img src="assets/kit-light.svg" width="840" alt="The kit. Languages: Python, C++, C, CUDA, SQL. Infrastructure: Nsight Systems, Nsight Compute, Docker, Linux, Git, PostgreSQL, FastAPI. Machine learning: PyTorch, PyTorch Geometric, scikit-learn, XGBoost, LangGraph, FAISS. Speaks Punjabi, Hindi and English."></picture>

<br><br>

<a href="https://satnamwanders.dev"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/links/site-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/links/site-light.svg"><img src="assets/links/site-light.svg" height="40" alt="satnamwanders.dev"></picture></a>
<a href="https://www.linkedin.com/in/satnamcodes"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/links/linkedin-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/links/linkedin-light.svg"><img src="assets/links/linkedin-light.svg" height="40" alt="LinkedIn"></picture></a>
<a href="https://twitter.com/gitblamesatnam"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/links/x-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/links/x-light.svg"><img src="assets/links/x-light.svg" height="40" alt="X, @gitblamesatnam"></picture></a>
<a href="https://www.instagram.com/dontblamesatnam"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/links/instagram-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/links/instagram-light.svg"><img src="assets/links/instagram-light.svg" height="40" alt="Instagram, @dontblamesatnam"></picture></a>

<br><br>

<sub><b>spaceflora</b>: astrophotography outreach, featured by NASA</sub>

</div>
