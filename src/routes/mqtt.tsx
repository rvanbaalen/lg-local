import { createFileRoute } from '@tanstack/react-router';
import MQTTMonitor from '../components/MQTTMonitor';

export const Route = createFileRoute('/mqtt')({
  component: MQTTMonitor,
});