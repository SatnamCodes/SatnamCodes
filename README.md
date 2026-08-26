<h1 align="center">Satnam Singh</h1>

<div align="center">
<pre>
                   ......             .::::..
               .:.::::-=+**====-:::-+*%@@@@@%*=:. ......
              :::=+*#%%%@@@@@@@@@@@@@@@@@@@@@@@%%##%#**+=-:
            :+*#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##++*-.
         :+#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%#*+#=
       .*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##*#%@@@@@@@@%%@@#=%.
      :%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%+=-::--+#%@@@@@@@@%@#=.
     +@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+::::...::-+#@@@@@@%@%.
    *@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@***:.........:-+#@@@@%#:
   =@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*==*::.........::-+@@@@:
  -@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*===+-:::.........::=@%-.
 :%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#*==--::::..........  .=+
 *@@@@@@@@@@@@@@@@@@@@@@@@@@%##+=----------::..    .:=###=
.#@@@@@@@@@@@@@@@@@@@@@%#*++===--+*#%%%%%%%@%#*=:..-*#*=--
.#@@@@@@@@@@@@@@@@@@@%*==------=*##*++=--=*###*+-. -*==+*-
 *@@@@@@@@@@@@@@@@%%#*=-----===++==+**++##%@#**+=-:.---*+:
 =@@@@@@@@@@@@@@%%%#**+=========+*#%%#+-=+===+++==--..::..
 .%@@@@@@@@@@@@%#%##**+======---=======-:::::---------:....
  :@@@@@%******+=++*#*+======----:::::........:--====--:. ..
   =@@@%+*+=++=-====+*+======-----:::...  ....:-==---=++-:..
    :%@#+*=-=+*+==---+*+========----:::.......:=*==+*##*-:.
     :%%++=-+****=---=**++========----::::....:-==+*#%#+##*=.
      :@%*+=++==+*+===+***+========-----::::::::-=#%#*===--+*:
       =@%*+====-=+=+++*##**+++++=====--------=*%%#+======---.
        *@@%#*+=---=#*+*#%#*++++++++=====-----+#*****+-:::::.
         =%@@@@%##******####*++++++++==++===-=---=+==+***#+:.
          .#@@@@@@%#****#%%##***++++=++++====------==+*##+:..
           .*@@@@@@#*+**#%@%%####******+++++======--:::::::--.
            :%@@@@@%#*+++*%@@%%@@%%%%%####***++=--------=+=+#-
           .+%@@@@@%#*+++++#%@@@@@@@@@@@@@@@@%%#*+*#%###%@@@#.
          .:==:*%@@%**++++++*##%@@@@@@@@@@@@@@@@@@@@@@@@##*=.
                ...-++++++++++*###%%%%%%@@@@@@%#*+=-:::.
                   :*+**++++++***********####*=:.. .:
                  :+*****++++++++++*+*++++++=-:::...:=:.
              .-=+********++++++++++++**++==-::::... :=.. ... ..
         .:-==#%*************+++++++++***+=----::....-- :. .-. :--.
      .:-+#*#**%#************++++++*+++++==----:::...=: :...:-. .=+-.   ...
   .:=**#*****+*#*************+++++*+++=-------:::..-= ......::  .=+=:  ...:...
</pre>
</div>

<p align="center">
  <em>"Any sufficiently advanced technology is indistinguishable from magic."<br>&mdash; Arthur C. Clarke</em>
</p>

---

<div align="center">

Physics moves first, indifferent to intention.

Mathematics follows, stripping meaning down to what cannot lie.

Computation arrives last, indifferent to both,<br>demanding that every idea survive execution.

They do not meet by harmony, but by pressure.

**At convergence, there is no room for belief &mdash; only what holds.**

</div>

---

## The Three Layers

```
        PHYSICS          the substrate       what the universe permits
           |
           v
      MATHEMATICS        the language        what cannot be argued with
           |
           v
      COMPUTATION        the proof           what actually runs at 3 AM
```

<table>
<tr>
<td width="33%" valign="top">

### ⚛ Physics

Wide-bandgap semiconductors, defect
formation energies, and why p-type
doping in **&beta;-Ga<sub>2</sub>O<sub>3</sub>** is still
an open problem.

Before that: photons from objects
that stopped emitting them
millions of years ago.

</td>
<td width="33%" valign="top">

### ∑ Mathematics

Linear algebra as the load-bearing
wall of everything else.

Graph representations, spectral
methods, optimization, and the
quiet arithmetic of

<code>C = &alpha;AB + &beta;C</code>

</td>
<td width="33%" valign="top">

### ⌘ Computation

Where the other two go to get
falsified.

CUDA kernels, memory hierarchies,
ISA specifications, and the
unforgiving distance between
*correct* and *fast*.

</td>
</tr>
</table>

---

## ⚙ Currently Executing

**`matmul-optimization`** &mdash; CUDA / C++
> Walking a naive SGEMM kernel toward cuBLAS-class throughput.
> `169.6 GFLOPS → 1052.9 GFLOPS` on an RTX 4060 &mdash; **6.5&times;** &mdash; via memory
> coalescing, warp-aware thread mapping, and 32&times;32 shared-memory tiling.
> Next: register blocking, warp tiling, WMMA / Tensor Core paths, mixed precision.

**`riscv-db`** &mdash; PostgreSQL / Python
> An ETL pipeline that turns 1,700+ YAML files of the official RISC-V ISA spec
> into a normalized 8-table relational database. **1,351 instructions** and
> **396 CSRs** &mdash; queryable with SQL instead of read manually.

**`gnn-dopant-viability`** &mdash; PyTorch / Research
> Defect-site-resolved graph neural networks predicting formation energy and
> ionization levels for p-type dopants in &beta;-Ga<sub>2</sub>O<sub>3</sub>.
> ~15,000 DFT-derived defect structures. Abstract under review at **IIM ATM 2026**.

**`radian`** &mdash; Computer Vision
> Persistent digital identities for individual trees, crops, and farmland parcels,
> derived from drone imagery. Continuous monitoring at scale.

---

## 🛠 Toolchain

```
languages   ::  Python  ·  C++  ·  C  ·  SQL
frameworks  ::  PyTorch  ·  XGBoost  ·  scikit-learn
tools       ::  CUDA  ·  Nsight  ·  FastAPI  ·  Docker  ·  Git  ·  Linux
domains     ::  Machine Learning  ·  Deep Learning  ·  GPU Programming
                High-Performance Computing  ·  Model Deployment
```

<p align="center">
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/C++-00599C?style=flat-square&logo=cplusplus&logoColor=white"/>
  <img src="https://img.shields.io/badge/C-A8B9CC?style=flat-square&logo=c&logoColor=black"/>
  <img src="https://img.shields.io/badge/CUDA-76B900?style=flat-square&logo=nvidia&logoColor=white"/>
  <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white"/>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white"/>
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black"/>
</p>

---

## 📐 Elsewhere

- **B.Tech CSE (AI & ML)** &mdash; Christ University, Bengaluru
- **B.S. Data Science & Applications** &mdash; IIT Madras *(online, concurrent)*
- **spaceflora** &mdash; astro & nature photography outreach, 100K+ monthly engagement, featured by NASA

---

## 🌐 Internet Coordinates

<p align="center">
  <a href="https://twitter.com/gitblamesatnam">
    <img src="https://img.shields.io/badge/X-000000?style=for-the-badge&logo=x&logoColor=white"/>
  </a>
  <a href="https://www.linkedin.com/in/satnamcodes">
    <img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white"/>
  </a>
  <a href="https://www.instagram.com/dontblamesatnam">
    <img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white"/>
  </a>
  <a href="https://github.com/SatnamCodes">
    <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white"/>
  </a>
</p>

<div align="center">
  <sub><code>while (understanding &lt; reality) { measure(); model(); compile(); }</code></sub>
</div>
