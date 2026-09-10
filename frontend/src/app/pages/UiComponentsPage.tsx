import type { ReactNode } from 'react';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { NoResultsState } from '@/components/ui/NoResultsState';
import { NotFoundState } from '@/components/ui/NotFoundState';
import { ServerErrorState } from '@/components/ui/ServerErrorState';
import { Spinner } from '@/components/ui/Spinner';

interface SectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

const Section = ({ title, description, children }: SectionProps) => (
  <section className="mt-10 first:mt-6">
    <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
    <p className="mt-1 text-sm text-muted">{description}</p>
    <div className="mt-4">{children}</div>
  </section>
);

/**
 * Internal styleguide at `/components-ui`, and the binding catalogue of the
 * project: no screen may use a component that is not shown here. Every
 * primitive is rendered in its real states (default, disabled, loading, with
 * an error, empty), so the page doubles as the visual check for a re-theme.
 */
const UiComponentsPage = () => {
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <>
      <h1 className="font-serif text-3xl font-bold tracking-[-0.015em] text-ink">Componentes UI</h1>
      <p className="mt-2 text-muted">
        Catálogo vinculante del sistema de diseño. Los componentes vienen de shadcn/ui, reescritos
        sobre los tokens del proyecto. Si necesitas uno que no está aquí, adáptalo primero y añádelo
        a esta página.
      </p>

      <Section
        title="Botones"
        description="Seis variantes y cuatro tamaños. El verde es la única acción de marca; el rojo queda reservado a lo destructivo."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button>Principal</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="link">Enlace</Button>
          <Button variant="destructive">Eliminar</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Pequeño</Button>
          <Button size="default">Normal</Button>
          <Button size="lg">Grande</Button>
          <Button size="icon" aria-label="Eliminar elemento">
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled>Deshabilitado</Button>
          <Button isLoading>Guardando</Button>
          <Button variant="outline" disabled>
            Contorno deshabilitado
          </Button>
        </div>
      </Section>

      <Section
        title="Campos"
        description="Campo etiquetado: la etiqueta es obligatoria, la contraseña trae interruptor de visibilidad y el error se conecta con aria-describedby."
      >
        <div className="flex max-w-sm flex-col gap-4">
          <Input label="Correo electrónico" type="email" placeholder="nombre@correo.com" />
          <Input
            label="Contraseña"
            type="password"
            defaultValue="secreto"
            error="La contraseña debe tener al menos 8 caracteres."
          />
          <Input label="Identificador" type="text" defaultValue="No editable" disabled />
        </div>
      </Section>

      <Section
        title="Tarjeta"
        description="Superficie única del sistema: cabecera, contenido y pie. Compón con className para el layout, nunca para repintar la superficie."
      >
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Título de ejemplo</CardTitle>
            <CardDescription>Subtítulo de ejemplo</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Contenido de ejemplo dentro de una tarjeta genérica del sistema de diseño.
            </p>
          </CardContent>
          <CardFooter>
            <Button size="sm">Aceptar</Button>
            <Button size="sm" variant="outline">
              Cancelar
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Section
        title="Avatar"
        description="Iniciales sobre círculo verde en tres tamaños. Con src muestra la imagen y cae a las iniciales si no carga."
      >
        <div className="flex items-center gap-3">
          <Avatar name="Ana Pérez" size="sm" />
          <Avatar name="Ana Pérez" size="md" />
          <Avatar name="Ana Pérez" size="lg" />
        </div>
      </Section>

      <Section
        title="Badge"
        description="Píldora de estado. La variante por defecto es la que usa la navegación para los contadores."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Nuevo</Badge>
          <Badge>2</Badge>
          <Badge variant="secondary">Borrador</Badge>
          <Badge variant="outline">Contorno</Badge>
          <Badge variant="destructive">Caducado</Badge>
        </div>
      </Section>

      <Section
        title="Spinner"
        description="Indicador de carga con role=status. Es el fallback de Suspense del layout."
      >
        <div className="flex items-center gap-3">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
      </Section>

      <Section
        title="Diálogo"
        description="Sobre Radix: atrapa el foco, cierra con Escape y al pulsar fuera, y anuncia aria-modal. Sustituye al antiguo Modal."
      >
        <Dialog>
          <DialogTrigger asChild>
            <Button>Abrir diálogo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Diálogo de ejemplo</DialogTitle>
              <DialogDescription>
                Contenido de ejemplo dentro del diálogo genérico del sistema de diseño.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button>Confirmar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section
        title="Estados del sistema"
        description="Los cuatro estados que sustituyen a cualquier bloque de «no hay datos» hecho a medida."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <EmptyState
            title="No hay elementos"
            description="Todavía no has añadido ningún elemento."
            actionLabel="Ver más"
            onAction={() => setLastAction('ver-mas')}
          />
          <NoResultsState onClearSearch={() => setLastAction('limpiar-busqueda')} />
          <NotFoundState onGoHome={() => setLastAction('volver-al-inicio')} />
          <ServerErrorState onRetry={() => setLastAction('reintentar')} />
        </div>
        {lastAction && <span className="sr-only">Última acción: {lastAction}</span>}
      </Section>
    </>
  );
};

// Default export required for React.lazy().
export default UiComponentsPage;
