# Por qué los puertos son `Protocol` y no clases abstractas

Las dos formas de declarar una interfaz en Python cumplen el mismo papel sobre el papel. Esta
plantilla usa `typing.Protocol` en todos los puertos, y la diferencia no es estética.

---

## Las dos opciones

La forma clásica, con `abc`:

```python
class UserRepository(ABC):
    @abstractmethod
    async def find_by_email(self, email: str) -> User | None: ...

class SqlAlchemyUserRepository(UserRepository):   # hereda
    async def find_by_email(self, email: str) -> User | None: ...
```

La que usa esta plantilla, con `Protocol`:

```python
class UserRepository(Protocol):
    async def find_by_email(self, email: str) -> User | None: ...

class SqlAlchemyUserRepository:                   # NO hereda
    async def find_by_email(self, email: str) -> User | None: ...
```

Las dos hacen que mypy compruebe que el adaptador cumple el contrato. La diferencia está en quién
depende de quién.

## Por qué `Protocol`

**Porque con ABC la flecha de dependencia se da la vuelta.** `SqlAlchemyUserRepository(UserRepository)`
es un import de `adapters` hacia `domain`, y eso está bien. Pero convierte el puerto en una
**superclase** del adaptador: el adaptador ya no puede existir sin el dominio cargado, y cualquier
cosa que herede acaba arrastrando lo que la base decida añadir mañana. `Protocol` es tipado
estructural: el adaptador cumple el contrato por tener los métodos, sin nombrarlo siquiera. El
dominio define la forma; nadie hereda de ella.

**Porque los dobles de test dejan de necesitar ceremonia.** Un `FakeUserRepository` con tres métodos
`async` y un diccionario dentro satisface el puerto sin heredar de nada ni importar el dominio para
otra cosa que los tipos. Con ABC, o hereda —y entonces tiene que implementar todos los
`@abstractmethod`, incluidos los que ese test no usa— o no es un `UserRepository` a ojos de mypy.
Esto es lo que hace viable la regla de [fakes, no mocks](../../docs/backend-testing.md).

**Porque un `Protocol` no puede traer implementación por la puerta de atrás.** Una ABC admite
métodos concretos, y en cuanto admite uno empieza a acumularlos: un helper aquí, un `save()` genérico
allá, y el puerto deja de ser un contrato para convertirse en una clase base con lógica que el
dominio no debería tener. `Protocol` no da esa opción. El cuerpo de cada método es `...` y punto.

**Porque obliga a que el puerto sea pequeño.** Sin herencia no hay nada que reutilizar, así que no
hay incentivo para declarar métodos "por si acaso". `UserRepository` tiene tres métodos porque la
autenticación usa tres. Esa es exactamente la propiedad que se busca: **el puerto es la lista de la
compra del dominio, no un espejo de lo que sabe hacer el ORM.**

## Lo que se pierde

- **No hay error en tiempo de carga.** Una ABC revienta al instanciar una subclase incompleta;
  `Protocol` solo falla en mypy. Sin `mypy --strict` en CI, un puerto y su adaptador pueden
  desincronizarse sin que nadie se entere. Aquí esa red existe, y por eso la decisión es segura.
- **`isinstance()` no funciona** salvo que el puerto se marque `@runtime_checkable`, y aun así solo
  comprueba los nombres de los métodos, no sus firmas. No se usa en ningún sitio del repo.
- **Es menos familiar.** Quien viene de Java o de C# espera ver la herencia y echa de menos la pista
  visual de "esta clase implementa esto". Lo sustituye el docstring del adaptador, que nombra el
  puerto explícitamente:
  `"""Implements `UserRepository` (see `domain/ports/repositories.py`) with SQLAlchemy."""`

## La regla

Todo puerto es `Protocol`. Ningún adaptador hereda de su puerto. El docstring del adaptador nombra el
puerto que cumple, porque es lo único que queda como pista para quien lee.

---

## Ver también

- Los puertos actuales: `backend/src/domain/ports/`
- [`por-que-hexagonal.md`](./por-que-hexagonal.md)
- [`docs/backend-testing.md`](../../docs/backend-testing.md) — fakes, no mocks
