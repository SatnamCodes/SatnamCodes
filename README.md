<div align="center">

<details>
<summary><a name="totem"><img src="assets/totem.svg" width="840" alt="A steel spinning top on a dark table under one lamp, running on my last two weeks of work: spinning true when I've been building steadily, wobbling when I haven't, at rest when I stop. Click it to open its blueprint."></a><br><sub>Click the top for its blueprint and its other states</sub></summary>
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
<a name="wobbling-top"><img src="assets/states/wobbling-top.svg" width="420" alt="The top wobbling, from an example fortnight."></a>
<br>
<picture><source media="(prefers-color-scheme: dark)" srcset="assets/states/wobbling-blueprint-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/states/wobbling-blueprint-light.svg"><img src="assets/states/wobbling-blueprint-light.svg" width="840" alt="Its blueprint, wobbling: 3 contributions in 14 days, steadiness 0.3."></picture>
</details>
<details>
<summary><a name="at-rest"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/states/at-rest-button-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/states/at-rest-button-light.svg"><img src="assets/states/at-rest-button-light.svg" height="40" alt="See it at rest"></picture></a></summary>
<br>
<a name="at-rest-top"><img src="assets/states/at-rest-top.svg" width="420" alt="The top at rest, from an example fortnight."></a>
<br>
<picture><source media="(prefers-color-scheme: dark)" srcset="assets/states/at-rest-blueprint-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/states/at-rest-blueprint-light.svg"><img src="assets/states/at-rest-blueprint-light.svg" width="840" alt="Its blueprint, at rest: 0 contributions in 14 days, steadiness 0."></picture>
</details>
<!-- /states -->

</details>

<!-- totem -->
<sub><b>Spinning true</b> · 46 contributions in the last 14 days · measured 9 Oct 2026</sub>
<!-- /totem -->

</div>

## Satnam Singh

**Machine learning engineering · AI infrastructure · AI research · Software engineering**

I build machine learning models of physical systems and the GPU code they run on, and I profile both until the numbers make sense.

- **AI infrastructure.** A CUDA SGEMM taken from a naive kernel through coalescing and shared-memory tiling, 169.6 → 1,052.9 GFLOPS on an RTX 4060 (6.5×), profiled in Nsight Systems and Nsight Compute; register blocking, warp tiling and Tensor Cores next. Warp divergence measured in neighbor-gather kernels over a million particles.
- **AI research.** Graph neural networks over a defect's real crystal structure, to predict formation energy and ionization levels of p-type dopants in β-Ga₂O₃ (abstract under review at IIM ATM 2026). An independent study of whether exoplanet habitability indices reduce to a few physical quantities.
- **ML engineering.** NodeGuard, a GCN in PyTorch Geometric that finds fraud rings under heavy class imbalance; recall-only checkpointing converged on a degenerate model, so it checkpoints on F1. A multi-agent retrieval system (LangGraph, FAISS) that checks each generated claim against its sources with sentence-level NLI.
- **Software engineering.** A pipeline that loads 1,700+ RISC-V YAML specification files into PostgreSQL: 8 tables, 1,351 instructions, 396 control and status registers. Python, C++, FastAPI, Docker, Linux.

**Education.** Indian Institute of Technology Madras, B.S. in Data Science and Applications (2025–2029) · Delhi Public School, Bathinda

<div align="center">

<br>

<a href="https://github.com/SatnamCodes/matmul"><img src="assets/shots/sgemm.svg" width="410" alt="Custom SGEMM: matrix multiplication drawn as a room of three walls, tiles of C filling as strips of A and B light up. 169.6 to 1,052.9 GFLOPS on an RTX 4060."></a>
<a href="https://satnamwanders.dev/research/p-type-dopants-in-beta-ga2o3"><img src="assets/shots/dopants.svg" width="410" alt="p-type dopants in beta-Ga2O3: a crystal lattice turning under a lamp, one dopant glowing. Abstract under review at IIM ATM 2026."></a>

<a href="https://github.com/SatnamCodes/gpu-neighbor-gather-divergence"><img src="assets/shots/warp.svg" width="410" alt="Warp divergence: 32 lanes as rods, each lane's work a bead sliding down; with uneven work most wait for the slowest."></a>
<a href="https://satnamwanders.dev/projects/nodeguard"><img src="assets/shots/nodeguard.svg" width="410" alt="NodeGuard: a transaction graph in three dimensions, the camera circling it; the fraud ring is the warm knot."></a>

<a href="https://satnamwanders.dev/projects/risc-v-knowledge-db"><img src="assets/shots/riscv.svg" width="410" alt="RISC-V specification database: a split-flap board spelling out 32-bit instruction words, their fields bracketed beneath."></a>
<a href="https://satnamwanders.dev"><img src="assets/shots/exoplanets.svg" width="410" alt="Exoplanet habitability: a planet on an eccentric orbit transiting its star, the light curve dipping."></a>

<br><br>

<img src="assets/city.svg" width="840" alt="The last year of contributions as a city, a block a day, as tall as that day's work; the past recedes into haze and the last fortnight is lit.">

<br><br>

<img src="assets/kit.svg" width="840" alt="The kit, machined plates dropped onto a table. Languages: Python, C++, C, CUDA, SQL. Infrastructure: Nsight Systems, Nsight Compute, Docker, Linux, Git, PostgreSQL, FastAPI. Machine learning: PyTorch, PyTorch Geometric, scikit-learn, XGBoost, LangGraph, FAISS. Speaks Punjabi, Hindi and English.">

<br><br>

<a href="https://satnamwanders.dev"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/links/site-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/links/site-light.svg"><img src="assets/links/site-light.svg" height="40" alt="satnamwanders.dev"></picture></a>
<a href="https://www.linkedin.com/in/satnamcodes"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/links/linkedin-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/links/linkedin-light.svg"><img src="assets/links/linkedin-light.svg" height="40" alt="LinkedIn"></picture></a>
<a href="https://twitter.com/gitblamesatnam"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/links/x-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/links/x-light.svg"><img src="assets/links/x-light.svg" height="40" alt="X, @gitblamesatnam"></picture></a>
<a href="https://www.instagram.com/dontblamesatnam"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/links/instagram-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/links/instagram-light.svg"><img src="assets/links/instagram-light.svg" height="40" alt="Instagram, @dontblamesatnam"></picture></a>

<br><br>

<sub><b>spaceflora</b>: astrophotography outreach, featured by NASA</sub>

</div>
