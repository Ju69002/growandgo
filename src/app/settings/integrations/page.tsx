
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cloud, HardDrive, CheckCircle2, Loader2, Zap, AlertTriangle } from 'lucide-react';
import { useAuth, useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { signInWithGoogleDrive } from '@/firebase/non-blocking-login';
import { createDriveFolder } from '@/services/drive-service';
import { User, Company } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function IntegrationsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
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
    setIsConnecting(true);

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
      setIsConnecting(false);
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
              La synchronisation Google Drive est réservée aux entreprises possédant un forfait Business.
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

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-12 px-6 space-y-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Cloud className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Intégrations Cloud</h1>
            <p className="text-muted-foreground font-medium">Connectez vos outils préférés pour centraliser vos documents.</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-primary text-primary-foreground p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <HardDrive className="w-6 h-6" />
                    Google Drive
                  </CardTitle>
                  <CardDescription className="text-primary-foreground/70">Stockage externe sécurisé pour vos documents.</CardDescription>
                </div>
                {drive?.isConnected && <Badge className="bg-emerald-500 text-white font-black uppercase px-4 h-8 rounded-full border-none">Actif</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1 space-y-4">
                  <h3 className="text-lg font-bold">Comment ça marche ?</h3>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      Un dossier <strong>"Grow&Go Documents"</strong> est créé sur votre Drive.
                    </li>
                    <li className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      L'IA analyse le fichier puis le dépose directement dans votre Cloud.
                    </li>
                    <li className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      Vous gardez la pleine propriété de vos données physiques.
                    </li>
                  </ul>
                </div>

                <div className="w-full md:w-[350px] bg-muted/30 rounded-[2rem] p-8 border-2 border-dashed border-primary/10 flex flex-col items-center text-center gap-6">
                  {drive?.isConnected ? (
                    <>
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Connecté avec</p>
                        <p className="font-bold text-primary truncate max-w-[200px]">{drive.email}</p>
                      </div>
                      <Button variant="outline" onClick={handleConnectDrive} className="w-full rounded-xl font-bold h-11">
                        Changer de compte
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-primary/5 text-primary/40 rounded-full flex items-center justify-center">
                        <HardDrive className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold">Drive non connecté</p>
                        <p className="text-[10px] text-muted-foreground leading-tight px-4">Autorisez Grow&Go à créer un dossier pour vos documents.</p>
                      </div>
                      <Button 
                        onClick={handleConnectDrive} 
                        disabled={isConnecting}
                        className="w-full bg-primary rounded-xl font-bold h-12 shadow-lg gap-2"
                      >
                        {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                        Connecter Drive
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {drive?.isConnected && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                    <strong>Note :</strong> L'accès Drive est lié à votre session. Si un upload échoue, revenez ici pour rafraîchir la connexion. Seuls les nouveaux documents importés après connexion seront stockés sur Drive.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
