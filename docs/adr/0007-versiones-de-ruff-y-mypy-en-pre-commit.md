# Versiones de ruff y mypy en pre-commit

Registro de decisión de arquitectura (ADR): los hooks de pre-commit del backend ejecutan el ruff y
el mypy del `.venv` del proyecto, de modo que `backend/pyproject.toml` es la única lista de
versiones, tanto para el commit como para CI.

---

## Contexto

CI instala ruff, mypy y las dependencias del backend desde `backend/pyproject.toml`, donde todo está
fijado con `==`. El hook de pre-commit, en cambio, usaba repos remotos (`ruff-pre-commit` y
`mirrors-mypy`) con su propio `rev`, y las `additional_dependencies` del hook de mypy no estaban
fijadas: pre-commit resolvía las últimas versiones publicadas al crear su entorno. Hook y CI podían
dar veredictos distintos sobre el mismo árbol, que es lo que ya ocurrió cuando SQLAlchemy 2.1 retipó
`select(func.count())` y rompió `mypy --strict` en un fichero que nadie había tocado.

Además el alcance no coincidía: el hook revisaba solo `backend/src/` y, al ejecutarse desde la raíz
del monorepo, no leía el `[tool.mypy]` de `backend/pyproject.toml`, mientras que CI ejecuta `mypy
--strict .` dentro de `backend/`, es decir, también `tests/`, `alembic/` y `seed.py`.

## Decisión

- `ruff-check`, `ruff-format` y `mypy` son hooks locales que ejecutan el ruff y el mypy instalados en
  el `.venv` con `pip install -e ".[dev]"`. Es lo que ya hacían los hooks del frontend con el ESLint
  y el Prettier de `frontend/node_modules`.
- pre-commit no pone el `.venv` en el `PATH`, así que los hooks no llaman a `ruff` ni a `mypy` por su
  nombre: pasan por `scripts/run_in_venv.py`, que ejecuta `python -m <herramienta>` con el
  intérprete del `.venv` por su ruta (`.venv/Scripts/python.exe` en Windows, `.venv/bin/python` en
  el resto). Los hooks son `language: python` solo para tener un Python con el que lanzar el script;
  no instalan nada.
- El hook de mypy ejecuta el comando del job `lint` de CI, `mypy --strict .` dentro de `backend/`,
  con `pass_filenames: false`. Se dispara con cualquier `.py` de `backend/` y también con
  `backend/pyproject.toml`, porque una subida de versión o un cambio en `[tool.mypy]` pueden romper
  el tipado sin tocar ningún `.py`.
- Si no existe el `.venv`, el hook falla y pide ejecutar `make setup`.

Se comprobó de dos formas. Con un error de tipos plantado en `src/` y otro en `tests/`, el hook y el
comando de CI dan los mismos dos errores sobre los mismos 99 ficheros. Y con un `PATH` sin ningún
Python, ruff ni mypy, los tres hooks siguen pasando.

## Alternativas descartadas

- **Hooks remotos con las versiones copiadas de `pyproject.toml` y una comprobación de deriva.** Fue
  la primera versión de esta misma PR: el `rev` de cada hook y cada `additional_dependencies` del
  de mypy se fijaban a mano con la versión de `pyproject.toml`, y un script fallaba, en el commit y
  en CI, si dejaban de coincidir. Funcionaba, pero cada librería nueva o cada subida exigía editar
  dos ficheros, cada PR de Dependabot (#16) habría fallado hasta añadirle un commit a mano, y el
  script, sus tests y la lista copiada eran código que mantener solo para sostener la copia.
- **Hooks locales que llaman a `ruff` y a `mypy` por su nombre (`language: system`).** pre-commit no
  pone el `.venv` en el `PATH`: en una prueba, un hook así ejecutó el Python 3.13 global y un ruff
  global en lugar de los del proyecto. Llamar al intérprete del `.venv` por su ruta evita el `PATH`
  por completo.
- **Ejecutar `pre-commit run --all-files` también en CI.** Hook y CI ya usan las mismas versiones,
  porque los dos instalan desde `pyproject.toml` y ejecutan los mismos comandos; hacerlo solo
  sumaría tiempo al job `lint`.

## Consecuencias

- Añadir o subir una librería, ruff o mypy solo exige tocar `backend/pyproject.toml`. Las PR de
  Dependabot (#16) no necesitarán nada más.
- El hook usa lo que haya instalado en el `.venv`. Tras cambiar `pyproject.toml` hay que reinstalar
  (`pip install -e ".[dev]"` desde `backend/`); hasta entonces el hook sigue con las versiones
  anteriores y la diferencia aparece en CI, igual que al ejecutar pytest con un `.venv`
  desactualizado.
- Los hooks del backend necesitan el `.venv`. No es un requisito nuevo: `make install-hooks` ya
  ejecutaba pre-commit desde él.
- Tras una subida ya no hay ningún entorno de pre-commit que reconstruir: el hook usa directamente
  lo que acaba de instalar `pip`.
- El veredicto no depende de qué Python, ruff o mypy haya en el `PATH`, pero sí del intérprete con
  el que se creó el `.venv`. mypy revisa siempre como Python 3.12, por el `python_version` de
  `[tool.mypy]`; si el `.venv` usa otra versión, como el 3.13 con el que se escribió este ADR, las
  dependencias transitivas instaladas pueden no ser las mismas que en CI.
- Las dependencias transitivas siguen sin fijar, en el hook y en CI por igual. De eso se ocupa #64.
