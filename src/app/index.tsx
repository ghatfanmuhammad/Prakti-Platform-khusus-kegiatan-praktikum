import { Redirect } from 'expo-router';
import { usePrakti } from '../context/PraktiContext';
export default function Index() {
  const { currentUser } = usePrakti();
  return <Redirect href={currentUser ? { pathname: '/[role]', params: { role: currentUser.role } } : '/login'} />;
}
