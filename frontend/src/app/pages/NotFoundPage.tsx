import { useNavigate } from 'react-router-dom';
import { NotFoundState } from '@/components/ui/NotFoundState';

/** Catch-all page rendered for any route that does not match a known path. */
const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center py-12">
      <NotFoundState onGoHome={() => navigate('/')} />
    </div>
  );
};

// Default export required for React.lazy().
export default NotFoundPage;
