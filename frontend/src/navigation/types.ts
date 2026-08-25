import type { Ligand } from '../types';

// Settings is reachable from *both* stacks, and deliberately so: the server URL
// lives there, and a phone that cannot reach the backend can never log in to get
// at the authenticated copy. See RootNavigator.
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Settings: undefined;
};

export type AppStackParamList = {
  LigandList: undefined;
  LigandView: { ligand: Ligand };
  Settings: undefined;
};
