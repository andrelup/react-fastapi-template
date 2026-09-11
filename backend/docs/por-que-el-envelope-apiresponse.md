# Por qué todas las respuestas van envueltas en `ApiResponse`

Todo endpoint de esta API devuelve la misma forma:

```json
{ "success": true,  "data": { "id": 1, "name": "Manual" }, "error": null }
{ "success": false, "data": null, "error": "Item 42 not found" }
```

Nunca el recurso pelado. Es una decisión discutible y conviene dejar escrito por qué se tomó, porque
la alternativa —devolver el recurso directamente y dejar que el código HTTP hable— es la que
recomienda buena parte del mundo REST.

---

## La decisión

Un envoltorio genérico, `ApiResponse[DataT]` en `adapters/inbound/schemas/common.py`, con tres
campos siempre presentes: `success`, `data` y `error`. El middleware `error_handler` lo construye en
el lado del fallo; los routers lo construyen en el lado del éxito.

## Por qué

**Porque el cliente tiene un único punto de desempaquetado.** En el SPA, `src/lib/api-client.ts`
valida la forma, lanza `ApiError` si `success` es falso y devuelve `payload.data`. A partir de ahí
**ningún otro fichero del frontend ve el envoltorio**: los módulos de API de cada feature tipan el
genérico al contenido (`apiClient.get<RawItemPage>`), y los componentes reciben datos de dominio. La
gestión de errores está escrita una vez, en un fichero, en lugar de repetida en cada llamada.

**Porque el error tiene un sitio garantizado.** Sin envoltorio, un 403 devuelve lo que devuelva el
framework, un 422 devuelve el formato de Pydantic, y un 500 devuelve otra cosa distinta. Con
envoltorio, los tres devuelven `{"success": false, "data": null, "error": "..."}` y el cliente lee
siempre el mismo campo. `error_responses()` documenta además esa forma real en Swagger, en lugar del
`HTTPValidationError` que FastAPI asume por defecto y que esta API no devuelve nunca.

**Porque hace trivial una garantía de seguridad concreta.** La ruta de login tiene que responder
exactamente lo mismo ante un email desconocido, una contraseña incorrecta y un cuerpo malformado — si
no, el código de estado se convierte en un oráculo de enumeración de usuarios. Con todos los errores
pasando por el mismo manejador y saliendo con la misma forma, colapsar los tres casos en un 401
idéntico es un `if` en `error_handler.py`. Sin envoltorio habría que interceptar el formato de
Pydantic caso por caso.

**Porque `success` no es redundante con el código HTTP en la práctica.** Debería serlo. Pero entre
proxies que reescriben códigos, clientes que tratan cualquier 2xx como éxito y respuestas que
atraviesan capas intermedias, tener el resultado también en el cuerpo hace que el contrato no dependa
de que nadie toque la cabecera por el camino.

## Lo que cuesta

- **Un nivel de anidamiento en cada respuesta.** `response.json()["data"]["items"]` en vez de
  `response.json()["items"]`. Se nota sobre todo escribiendo tests.
- **Redundancia real con el código HTTP.** `success: false` junto a un 403 dice dos veces lo mismo.
- **No es REST idiomático.** Un cliente genérico —un SDK generado, una herramienta de exploración—
  espera el recurso en la raíz. Aquí hay que enseñarle a desenvolver.
- **Hay que acordarse siempre.** Un router que devuelve el schema pelado rompe el contrato sin que
  nada falle hasta que el cliente lo consume. La anotación `response_model=ApiResponse[T]` es lo que
  lo hace visible en la firma.

## La regla

Todo endpoint declara `response_model=ApiResponse[T]` y devuelve
`ApiResponse(success=True, data=..., error=None)`. Los fallos no se construyen a mano: se lanza una
excepción de dominio y `error_handler` la traduce. Un endpoint sin cuerpo devuelve
`ApiResponse[None]` con `data=None`, no un `204`.

Y en el frontend, la contrapartida: **nada fuera de `src/lib/api-client.ts` sabe que el envoltorio
existe.**

---

## Ver también

- El envoltorio y `error_responses()`: `backend/src/adapters/inbound/schemas/common.py`
- La traducción de errores: `backend/src/adapters/inbound/middleware/error_handler.py`
- El desempaquetado en el cliente: `frontend/src/lib/api-client.ts`
- [`roles-y-registro-abierto.md`](./roles-y-registro-abierto.md) — la otra decisión deliberada del
  borde HTTP
