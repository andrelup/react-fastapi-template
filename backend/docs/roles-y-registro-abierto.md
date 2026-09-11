# Roles y registro abierto: hasta dónde llega la plantilla

Registro de decisión de arquitectura (ADR): por qué `/auth/register` acepta el `role` que le manda el cliente, por qué la plantilla **no** lo cierra, y qué le toca decidir a quien construya sobre ella.

---

## Contexto

react-fastapi-template trae la autenticación resuelta de punta a punta: alta de cuenta, login con JWT, sesión restaurada al recargar y tres roles jerárquicos —`admin` > `editor` > `viewer`— con `get_current_user` en el backend y `hasRole` / `RoleRoute` en la SPA.

El alta de cuenta es un endpoint público, y el rol viaja en el payload:

```python
class RegisterRequest(BaseModel):
    email: EmailStr = Field(examples=["jane.doe@example.com"])
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = Field(default=UserRole.VIEWER, description="Role granted to the new account.")
```

La consecuencia es directa y conviene decirla sin rodeos: **tal y como se distribuye la plantilla, cualquiera que alcance `POST /auth/register` puede darse de alta como `admin`**. No es un descuido pendiente de arreglar; es el punto donde la plantilla se detiene a propósito.

## Por qué la plantilla no lo cierra

**Porque aquí los roles son una simulación, no un modelo de permisos.** Existen para enseñar el mecanismo completo —un rol que nace en la base de datos, viaja en el JWT, llega al frontend y condiciona una ruta—, no para decidir quién manda en un negocio que todavía no existe. El proyecto que salga de esta plantilla tendrá probablemente **otros roles y otras funciones**: puede que le sobre `editor`, puede que necesite `owner`, `support` y `billing`, puede que el rol no baste y haga falta permisos por recurso, propiedad del dato o multi-tenancy.

**Porque no hay una forma genérica de hacerlo.** Cerrar el registro admite al menos cinco respuestas razonables, y la buena depende del proyecto, no del framework:

| Estrategia | Encaja cuando |
|---|---|
| Fijar `UserRole.VIEWER` en el router e ignorar lo que mande el cliente | Producto self-service donde todos entran por abajo y alguien promociona después |
| Admin raíz sembrado al arrancar, y registro solo para `ADMIN` autenticado | Herramienta interna con altas controladas: no hay registro público en absoluto |
| Invitaciones con token de un solo uso que lleva el rol dentro | SaaS por equipos, donde el rol lo decide quien invita |
| Delegar el alta en un IdP externo (OIDC/SAML) y mapear roles desde sus *claims* | Empresa con SSO: el registro deja de ser asunto de la aplicación |
| Registro abierto con verificación de correo y aprobación manual | Comunidades donde la barrera es el spam, no el privilegio |

Elegir una por ti significaría que quien adopte la plantilla tiene que **deshacer** una decisión antes de tomar la suya. Cada una de las cinco arrastra además su propio equipaje —un seeder, una tabla de invitaciones, un flujo de correo, configuración de IdP— que no pinta nada en un andamiaje.

**Porque el riesgo real es cero mientras sea una plantilla.** El agujero solo existe cuando hay un despliegue, usuarios y datos. Ahí es donde debe cerrarse, con la información que a esa altura ya se tiene y aquí no.

## Qué se lleva de aquí quien use la plantilla

- El mecanismo de punta a punta: rol persistido, incluido en el token, expuesto en `/auth/me`, comprobado en el backend y en la SPA.
- El sitio exacto donde enchufar la política: `register()` en `backend/src/adapters/inbound/api/auth_router.py` y el schema `RegisterRequest` en `backend/src/adapters/inbound/schemas/auth_schemas.py`.
- La separación que sí es una regla del proyecto y conviene respetar: la autenticación responde *quién* es quien llama; *qué puede hacer* se decide en los servicios de dominio, nunca en el router (ver [arquitectura-hexagonal.md](./arquitectura-hexagonal.md)).

## Consecuencias

- Un escáner de seguridad marcará `/auth/register` como escalada de privilegios. **Es un hallazgo correcto y esperado**, no un falso positivo: la respuesta es esta página, no un parche.
- El test `test_register_honours_a_client_supplied_role` fija el comportamiento a propósito, para que nadie lo "arregle" por reflejo. Si un proyecto cierra el registro, ese test se borra o se invierte junto con el cambio — no antes.
- Lo primero que debería hacer un proyecto real derivado de esta plantilla es tomar esta decisión. Es literalmente la línea de salida.
