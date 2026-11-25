import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { colors } from '../../theme';
import type { Koordinat } from '../../utils/geo';
import { titikLab, type Laboratorium } from './models';

export interface LabMapProps {
  labs: Laboratorium[];
  pengguna: Koordinat | null;
  terpilihId: string | null;
  onPilih: (lab: Laboratorium) => void;
}

/** Peta native (Android/iOS): marker laboratorium dan marker posisi pengguna (SRS-015). */
export function LabMap({ labs, pengguna, terpilihId, onPilih }: LabMapProps) {
  const peta = useRef<MapView>(null);
  const sudahFokus = useRef(false);

  // Fokuskan peta sekali ke semua titik begitu data pertama tersedia.
  useEffect(() => {
    if (sudahFokus.current || !peta.current) return;
    const titik: Koordinat[] = [...labs.map(titikLab), ...(pengguna ? [pengguna] : [])];
    if (titik.length === 0) return;
    sudahFokus.current = true;
    peta.current.fitToCoordinates(titik, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }, [labs, pengguna]);

  const terpilih = labs.find((l) => l.id === terpilihId);

  return (
    <MapView
      ref={peta}
      style={styles.peta}
      initialRegion={{ latitude: -2.5, longitude: 118, latitudeDelta: 30, longitudeDelta: 30 }}
    >
      {labs.map((lab) => (
        <Marker
          key={lab.id}
          coordinate={titikLab(lab)}
          title={lab.nama}
          pinColor={lab.id === terpilihId ? colors.accent : colors.navy}
          onPress={() => onPilih(lab)}
        />
      ))}
      {terpilih ? (
        <Circle
          center={titikLab(terpilih)}
          radius={terpilih.radiusMeter}
          strokeColor={colors.navy}
          fillColor="rgba(11, 26, 92, 0.12)"
        />
      ) : null}
      {pengguna ? (
        <Marker coordinate={pengguna} title="Posisi Anda" pinColor={colors.success} />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({ peta: { flex: 1 } });