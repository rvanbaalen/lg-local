import { createFileRoute } from '@tanstack/react-router';
import DeviceManager from '../components/DeviceManager';

export const Route = createFileRoute('/devices')({
  component: DeviceManager,
});