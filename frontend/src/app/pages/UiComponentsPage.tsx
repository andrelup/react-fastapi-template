import type { ReactNode } from 'react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { NoResultsState } from '@/components/ui/NoResultsState';
import { NotFoundState } from '@/components/ui/NotFoundState';
import { ServerErrorState } from '@/components/ui/ServerErrorState';
import { Spinner } from '@/components/ui/Spinner';

interface SectionProps {
  title: string;
  children: ReactNode;
}

const Section = ({ title, children }: SectionProps) => (
  <section className="mt-8 first:mt-6">
    <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

/** Internal styleguide page: showcases the shared `components/ui` primitives. */
const UiComponentsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <>
      <h1 className="font-serif text-3xl font-bold tracking-[-0.015em] text-ink">
        Componentes UI
      </h1>
      <p className="mt-2 text-muted">
        Catálogo de referencia de los componentes compartidos del sistema de diseño.
      </p>

      <Section title="Botones">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="danger">Peligro</Button>
          <Button variant="primary" disabled>
            Deshabilitado
          </Button>
          <Button variant="primary" isLoading>
            Cargando
          </Button>
        </div>
      </Section>

      <Section title="Campos">
        <div className="flex max-w-sm flex-col gap-4">
          <Input label="Correo electrónico" type="email" placeholder="nombre@correo.com" />
          <Input
            label="Contraseña"
            type="password"
            error="La contraseña debe tener al menos 8 caracteres."
          />
        </div>
      </Section>

      <Section title="Tarjeta">
        <Card className="max-w-sm">
          <h3 className="font-serif text-lg font-bold text-ink">El nombre del viento</h3>
          <p className="mt-1 text-sm text-body">Patrick Rothfuss</p>
          <p className="mt-3 text-sm text-muted">
            Contenido de ejemplo dentro de una tarjeta genérica del sistema de diseño.
          </p>
        </Card>
      </Section>

      <Section title="Avatar">
        <div className="flex items-center gap-3">
          <Avatar name="Ana Pérez" size="sm" />
          <Avatar name="Ana Pérez" size="md" />
          <Avatar name="Ana Pérez" size="lg" />
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap gap-3">
          <Badge>Nuevo</Badge>
          <Badge>2</Badge>
        </div>
      </Section>

      <Section title="Spinner">
        <div className="flex items-center gap-3">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
      </Section>

      <Section title="Modal">
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          Abrir modal
        </Button>
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Modal de ejemplo">
          <p className="text-sm text-body">
            Este es un contenido de ejemplo dentro del modal genérico del sistema de diseño.
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cerrar
            </Button>
          </div>
        </Modal>
      </Section>

      <Section title="Estados del sistema">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <EmptyState
            title="Tu carrito está vacío"
            description="Todavía no has añadido ningún libro a tu carrito."
            actionLabel="Explorar catálogo"
            onAction={() => setLastAction('explorar-catalogo')}
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
