import { create } from 'zustand'

export type DeviceMode = 'shared' | 'child' | 'parent'

type DeviceStore = {
  deviceMode: DeviceMode | null
  pin: string
  setDeviceMode: (mode: DeviceMode) => void
  clearDeviceMode: () => void
  setPin: (pin: string) => void
}

const getStored = (key: string) =>
  typeof window !== 'undefined' ? (localStorage.getItem(key) ?? '') : ''

export const useDeviceStore = create<DeviceStore>((set) => ({
  deviceMode: (() => {
    const v = getStored('cooanc_device_mode')
    return v === 'shared' || v === 'child' || v === 'parent' ? v : null
  })(),
  pin: getStored('cooanc_device_pin'),

  setDeviceMode: (mode) => {
    if (typeof window !== 'undefined') localStorage.setItem('cooanc_device_mode', mode)
    set({ deviceMode: mode })
  },
  clearDeviceMode: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cooanc_device_mode')
      localStorage.removeItem('cooanc_device_pin')
    }
    set({ deviceMode: null, pin: '' })
  },
  setPin: (pin) => {
    if (typeof window !== 'undefined') localStorage.setItem('cooanc_device_pin', pin)
    set({ pin })
  },
}))
