# Por qué arquitectura hexagonal en una plantilla

Por qué un CRUD con autenticación, que cabría en un `main.py` de trescientas líneas, está repartido
en dominio, puertos y adaptadores — y en qué momento esa decisión deja de tener sentido.

---

## El contexto

FastAPI no impone ninguna estructura. La documentación oficial enseña routers que reciben una sesión
de SQLAlchemy por `Depends`, consultan, y devuelven un modelo de Pydantic. Funciona, se lee de
corrido, y para un servicio pequeño es perfectamente defendible.

Esta plantilla no hace eso. Paga el coste de una capa de dominio que no sabe que existe FastAPI, de
unos puertos declarados como `Protocol` y de unos adaptadores que los implementan sin heredar de
ellos. La pregunta legítima es qué compra ese coste.

## La decisión

Arquitectura hexagonal (puertos y adaptadores), con la regla de dependencia apuntando siempre hacia
dentro: `adapters → domain`, nunca al revés. `config/container.py` es el único módulo que importa de
los dos lados.

## Por qué

**Porque es una plantilla, y su producto es el patrón.** Lo que se clona de aquí no es el catálogo de
ejemplo —eso se borra— sino la forma de añadir la siguiente feature. Un router que consulta la base
de datos directamente enseña a escribir routers que consultan la base de datos directamente. La
estructura es lo que se replica, así que la estructura *es* el entregable.

**Porque la lógica de autorización necesita vivir en algún sitio y ese sitio no es el router.** La
regla del catálogo —el EDITOR edita solo lo suyo, el ADMIN edita cualquier cosa— es una regla de
negocio, y la única forma de probarla sin levantar el stack ASGI entero es que esté en una clase que
reciba un `User` y un `Item` y no sepa nada de HTTP. En cuanto esa regla se puede probar en
milisegundos, se prueban todas sus celdas. Cuando cuesta un cliente HTTP y una base de datos, se
prueban tres.

**Porque el test unitario deja de necesitar una base de datos.** `ItemService` recibe un
`ItemRepository`. En producción es SQLAlchemy; en el test es un diccionario en memoria escrito a
mano. No hay contenedor que arrancar ni transacción que limpiar, y por eso la suite unitaria se puede
ejecutar en cada guardado.

**Porque el agente que trabaja sobre este repo necesita saber dónde va cada cosa.** "La autorización
va en el servicio de dominio" es una instrucción que se puede seguir. "Ponla donde parezca razonable"
no lo es. Buena parte del valor de esta estructura es que convierte decisiones de diseño en
ubicaciones de fichero.

## Lo que cuesta

No es gratis y conviene decirlo:

- **Tres representaciones de la misma cosa.** `Item` (dataclass), `ItemORM` (SQLAlchemy) e
  `ItemResponse` (Pydantic), más los mapeadores `_to_domain` y `_to_response` escritos a mano. Añadir
  un campo son cinco ficheros.
- **Indirección al leer.** Seguir una petición de punta a punta pasa por router → contenedor →
  servicio → puerto → repositorio, cuando en el enfoque plano habría una función.
- **Ceremonia desproporcionada para lo trivial.** Un endpoint de solo lectura sin reglas de negocio
  atraviesa las mismas cinco capas para hacer un `SELECT`.

## Cuándo no hacer esto

Si lo que vas a construir sobre esta plantilla es un servicio pequeño, sin reglas de autorización
más allá de "hay que estar autenticado", y sin expectativa de crecer, la estructura te va a estorbar
más de lo que te va a ayudar. En ese caso el camino correcto no es luchar contra ella: es aplanarla
deliberadamente, borrar la capa de puertos y dejar los routers hablando con los repositorios. Es una
decisión legítima y conviene tomarla pronto, no a medias.

El punto en el que esta estructura se paga sola es cuando aparece la **segunda** regla de negocio que
cruza dos entidades, o el **segundo** consumidor del mismo caso de uso.

---

## Ver también

- El recorrido ejecutable: [`docs/adding-a-feature.md`](../../docs/adding-a-feature.md)
- Las reglas en detalle: [`docs/backend-hexagonal-architecture.md`](../../docs/backend-hexagonal-architecture.md)
- La versión larga en español: [`arquitectura-hexagonal.md`](./arquitectura-hexagonal.md)
- [`por-que-protocol-y-no-abc.md`](./por-que-protocol-y-no-abc.md)
