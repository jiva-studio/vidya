import { Network } from '@capacitor/network'
import { onScopeDispose, ref } from 'vue'

/* -------------------------------------------------------------------------- */
/*                                 Composable                                 */
/* -------------------------------------------------------------------------- */

/**
 * Whether the device has a radio to reach a school with.
 *
 * The radio is asked about as well as listened to: `networkStatusChange`
 * announces a change and nothing else, so a launch with the radio already off
 * and a resume from the background are both silent, and a screen that started
 * watching then would wait for a change to a state the app had only assumed.
 *
 * One status per watcher rather than one for the app, so the listener is dropped
 * with the scope that asked for it instead of outliving every screen.
 */
export function useNetworkStatus() {
  const connected = ref(true)

  const listening = Network.addListener('networkStatusChange', (status) => {
    connected.value = status.connected
  })

  const askRadio = async (): Promise<void> => {
    connected.value = (await Network.getStatus()).connected
  }

  const stopListening = async (): Promise<void> => (await listening).remove()

  onScopeDispose(() => void stopListening(), true)

  void askRadio()

  return { connected }
}
