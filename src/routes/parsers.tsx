import { createFileRoute } from '@tanstack/react-router';
import ProtocolParsers from '../components/ProtocolParsers';

export const Route = createFileRoute('/parsers')({
  component: ProtocolParsers,
});