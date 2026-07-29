import type { Ligand } from '../types';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  LigandList: undefined;
  LigandView: { ligand: Ligand };
  Settings: undefined;
};
