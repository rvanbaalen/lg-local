import { createFileRoute } from '@tanstack/react-router';
import Configuration from '../components/Configuration';

export const Route = createFileRoute('/config')({
  component: Configuration,
});