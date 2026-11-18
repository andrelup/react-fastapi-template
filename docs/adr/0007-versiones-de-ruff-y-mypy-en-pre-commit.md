# Versiones de ruff y mypy en pre-commit

Registro de decisión de arquitectura (ADR): las versiones de ruff, de mypy y de las dependencias del
hook de mypy se copian de `backend/pyproject.toml` a `.pre-commit-config.yaml`, y una comprobación
de deriva falla cuando las copias dejan de coincidir.

---

## Contexto

CI instala ruff, mypy y las dependencias del backend desde `backend/pyproject.toml`, donde todo está
fijado con `==`. El hook de pre-commit, en cambio, usa repos remotos (`ruff-pre-commit` y
`mirrors-mypy`) con su propio `rev`, y las `additional_dependencies` del hook de mypy no estaban
fijadas: pre-commit resolvía las últimas versiones publicadas al crear su entorno. Hook y CI podían
dar veredictos distintos sobre el mismo árbol, que es lo que ya ocurrió cuando SQLAlchemy 2.1 retipó
`select(func.count())` y rompió `mypy --strict` en un fichero que nadie había tocado.

Además el alcance no coincidía: el hook revisaba solo `backend/src/` y, al ejecutarse desde la raíz
del monorepo, no leía el `[tool.mypy]` de `backend/pyproject.toml`, mientras que CI ejecuta `mypy
--strict .` dentro de `backend/`, es decir, también `tests/`, `alembic/` y `seed.py`.

## Decisión

- Se mantienen los hooks remotos. El `rev` de ruff y de mypy, y cada entrada de
  `additional_dependencies` del hook de mypy, se copian de `backend/pyproject.toml` y se fijan con
  `==`. Esto incluye las dependencias tipadas que importan los tests (pytest, httpx, faker…).
- El hook de mypy revisa todo `backend/` con `--strict --config-file=backend/pyproject.toml` y
  `pass_filenames: false`, de modo que da el mismo veredicto que el job `lint` de CI (se comprobó
  plantando un error de tipos en `src/` y otro en `tests/`: ambos fallan en el hook y en CI).
- `scripts/check_pin_drift.py` compara ambos ficheros y falla nombrando cada discrepancia: versión
  de ruff o de mypy, versión distinta de una dependencia, dependencia ausente de `pyproject.toml` o
  no fijada con `==`. Se ejecuta como hook local de pre-commit (`language: python`, con su propio
  entorno aislado y PyYAML declarado) y como paso del job `lint` de `ci-backend.yml`, cuyo `paths:`
  incluye ahora `.pre-commit-config.yaml` y el propio script.
- Los tests de la comprobación están en `backend/tests/unit/test_check_pin_drift.py`, porque
  `pytest` ya se ejecuta desde `backend/` en CI.

## Alternativas descartadas

- **Hooks locales (`language: system`) que usen el ruff y el mypy del `.venv`.** Era la opción que
  garantizaba una única fuente de versiones, pero se comprobó que pre-commit no pone el `.venv` en
  el `PATH`: en una terminal sin el entorno activado, el hook ejecutó el Python 3.13 global y un
  ruff global. Es una divergencia peor que la que se quería evitar.
- **Dejar `pre-commit autoupdate` como mecanismo de subida.** Mueve los `rev` por su cuenta y los
  aleja de `pyproject.toml`.
- **Generar `.pre-commit-config.yaml` desde `pyproject.toml`.** Añade un paso de generación y un
  fichero derivado que revisar, para ahorrar copiar unas pocas líneas que la comprobación ya vigila.

## Consecuencias

- Una release nueva de ruff, de mypy o de una dependencia no cambia el resultado del hook hasta que
  alguien sube la versión de forma explícita.
- Subir una versión exige hoy tocar dos sitios, `backend/pyproject.toml` y
  `.pre-commit-config.yaml`, en el mismo commit. Si se sube solo uno, el hook `check-pin-drift` y el
  job `lint` fallan indicando qué no coincide.
- Cuando llegue Dependabot (#16), sus PRs solo tocarán `pyproject.toml`; la comprobación fallará en
  ellas y obligará a incluir el cambio de pre-commit en la misma PR.
- La comprobación solo cubre ruff, mypy y las `additional_dependencies` del hook de mypy; las
  dependencias transitivas siguen sin fijar. De subir los pines y de cerrar esa brecha se ocupa #64.
- El hook de mypy es más lento que antes (revisa todo `backend/` y su entorno tiene más paquetes), y
  la primera ejecución tras una subida reconstruye el entorno.
- Quien clone la plantilla obtiene el mismo veredicto en el commit y en CI sin depender de qué
  Python o qué ruff tenga instalado.
