
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cloud, HardDrive, CheckCircle2, Loader2, Zap, AlertTriangle, CloudRain } from 'lucide-react';
import { useAuth, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { signInWithGoogleDrive, signInWithMicrosoftOneDrive } from '@/firebase/non-blocking-login';
import { createDriveFolder } from '@/services/drive-service';
import { createOneDriveFolder } from '@/services/onedrive-service';
import { User, Company } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function IntegrationsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isConnectingMicrosoft, setIsConnectingMicrosoft] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userRef);
  const companyId = profile?.companyId;

  const companyRef = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return doc(db, 'companies', companyId);
  }, [db, companyId]);

  const { data: company, isLoading: isCompanyLoading } = useDoc<Company>(companyRef);

  const isBusiness = company?.subscription?.planType === 'business' || companyId === 'admin_global';

  const handleConnectDrive = async () => {
    if (!db || !companyId || !auth) return;
    setIsConnectingGoogle(true);

    try {
      const { user: googleUser, token } = await signInWithGoogleDrive(auth);
      if (!token) throw new Error("Autorisation refusée");

      toast({ title: "Configuration Drive...", description: "Création de votre dossier sécurisé." });
      const folderId = await createDriveFolder(token, `Grow&Go Documents - ${company?.name || companyId}`);

      const ref = doc(db, 'companies', companyId);
      updateDocumentNonBlocking(ref, {
        'integrations.googleDrive': {
          isConnected: true,
          folderId: folderId,
          accessToken: token,
          email: googleUser.email
        }
      });

      toast({ title: "Google Drive Connecté !", description: "Vos futurs documents seront stockés sur votre Cloud." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur de connexion", description: error.message });
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleConnectOneDrive = async () => {
    if (!db || !companyId || !auth) return;
    setIsConnectingMicrosoft(true);

    try {
      const { user: msUser, token } = await signInWithMicrosoftOneDrive(auth);
      if (!token) throw new Error("Autorisation Microsoft refusée");

      toast({ title: "Configuration OneDrive...", description: "Création de votre espace de stockage." });
      const folderId = await createOneDriveFolder(token, `Grow&Go Documents - ${company?.name || companyId}`);

      const ref = doc(db, 'companies', companyId);
      updateDocumentNonBlocking(ref, {
        'integrations.oneDrive': {
          isConnected: true,
          folderId: folderId,
          accessToken: token,
          email: msUser.email
        }
      });

      toast({ title: "OneDrive Connecté !", description: "Vos documents seront centralisés sur Microsoft 365." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur Microsoft", description: error.message });
    } finally {
      setIsConnectingMicrosoft(false);
    }
  };

  if (!mounted || isCompanyLoading) return null;

  if (!isBusiness) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-20 px-6 text-center space-y-8">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
            <Zap className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-primary">Option Business Premium</h1>
            <p className="text-muted-foreground font-medium max-w-md mx-auto">
              La synchronisation Cloud est réservée aux entreprises possédant un forfait Business.
            </p>
          </div>
          <Button asChild className="rounded-full h-12 px-8 font-bold bg-primary shadow-lg">
            <a href="/team">Passer au forfait Business</a>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const drive = company?.integrations?.googleDrive;
  const oneDrive = company?.integrations?.oneDrive;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-12 px-6 space-y-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Cloud className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Intégrations Cloud</h1>
            <p className="text-muted-foreground font-medium">Centralisez vos documents sur vos outils préférés.</p>
          </div>
        </div>

        <div className="grid gap-8">
          {/* Google Drive Card */}
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-emerald-800 text-white p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <HardDrive className="w-6 h-6" />
                    Google Drive
                  </CardTitle>
                  <CardDescription className="text-white/70">Stockage externe pour vos documents Google Workspace.</CardDescription>
                </div>
                {drive?.isConnected && <Badge className="bg-emerald-500 text-white font-black uppercase px-4 h-8 rounded-full border-none">Actif</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-10">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1 space-y-2">
                  <h3 className="font-bold">Mode Smart Sync</h3>
                  <p className="text-sm text-muted-foreground">L'IA dépose automatiquement vos scans dans le dossier "Grow&Go Documents".</p>
                </div>
                <div className="w-full md:w-[300px]">
                  {drive?.isConnected ? (
                    <div className="bg-muted/30 p-4 rounded-2xl flex flex-col gap-3">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Connecté : {drive.email}</p>
                      <Button variant="outline" onClick={handleConnectDrive} className="w-full rounded-xl h-10 text-xs">Changer de compte</Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={handleConnectDrive} 
                      disabled={isConnectingGoogle}
                      className="w-full bg-emerald-800 rounded-xl font-bold h-12 shadow-lg gap-2"
                    >
                      {isConnectingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                      Connecter Drive
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OneDrive Card */}
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-blue-700 text-white p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <CloudRain className="w-6 h-6" />
                    Microsoft OneDrive
                  </CardTitle>
                  <CardDescription className="text-white/70">Intégrez votre stockage Microsoft 365 Entreprise.</CardDescription>
                </div>
                {oneDrive?.isConnected && <Badge className="bg-blue-500 text-white font-black uppercase px-4 h-8 rounded-full border-none">Actif</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-10">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1 space-y-2">
                  <h3 className="font-bold">Microsoft 365 Sync</h3>
                  <p className="text-sm text-muted-foreground">Centralisez vos documents administratifs sur votre Cloud Microsoft.</p>
                </div>
                <div className="w-full md:w-[300px]">
                  {oneDrive?.isConnected ? (
                    <div className="bg-muted/30 p-4 rounded-2xl flex flex-col gap-3">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Connecté : {oneDrive.email}</p>
                      <Button variant="outline" onClick={handleConnectOneDrive} className="w-full rounded-xl h-10 text-xs">Changer de compte</Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={handleConnectOneDrive} 
                      disabled={isConnectingMicrosoft}
                      className="w-full bg-blue-700 rounded-xl font-bold h-12 shadow-lg gap-2"
                    >
                      {isConnectingMicrosoft ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudRain className="w-4 h-4" />}
                      Connecter OneDrive
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="p-6 bg-amber-50 border border-amber-100 rounded-[2rem] flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 mt-1 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold text-amber-900">Note sur la confidentialité</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              En connectant un Cloud, Grow&Go n'accède qu'aux fichiers créés par l'application dans son dossier dédié. Vos autres fichiers personnels restent strictement privés et invisibles pour nos algorithmes.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
