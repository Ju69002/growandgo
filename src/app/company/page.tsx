
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { 
  Building2, 
  Save, 
  Loader2, 
  Palette, 
  LayoutTemplate,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase,
  updateDocumentNonBlocking
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { User, Company } from '@/lib/types';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function CompanyPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const { data: company, isLoading } = useDoc<Company>(companyRef);

  useEffect(() => {
    if (company?.name) {
      setCompanyName(company.name);
    }
  }, [company]);

  const handleSave = () => {
    if (!db || !companyId || !companyName.trim()) return;
    setIsSaving(true);
    const ref = doc(db, 'companies', companyId);
    updateDocumentNonBlocking(ref, { name: companyName });
    
    setTimeout(() => {
      setIsSaving(false);
      toast({ 
        title: "Profil mis à jour", 
        description: "Les informations de votre entreprise ont été enregistrées." 
      });
    }, 500);
  };

  const isPatron = profile?.role === 'admin' || profile?.role === 'super_admin';

  if (!isPatron && !isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto py-20 px-6 text-center space-y-4">
          <Building2 className="w-20 h-20 text-muted-foreground opacity-20 mx-auto" />
          <h1 className="text-2xl font-black uppercase">Accès Réservé</h1>
          <p className="text-muted-foreground">Seul le Patron peut modifier l'identité du studio.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-10 px-6 space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Mon Entreprise</h1>
            <p className="text-muted-foreground font-medium">Gérez l'identité visuelle et légale de votre studio Grow&Go.</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-primary text-primary-foreground p-8">
              <CardTitle className="text-xl flex items-center gap-2">
                <LayoutTemplate className="w-6 h-6" />
                Informations Générales
              </CardTitle>
              <CardDescription className="text-primary-foreground/70">
                Ces informations seront visibles par toute votre équipe.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cname" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nom du Studio / Entreprise</Label>
                <Input 
                  id="cname"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Grow&Go Design Studio..."
                  className="rounded-xl border-primary/10 h-12 font-bold"
                  disabled={isLoading}
                />
              </div>

              <div className="pt-4 flex justify-end">
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving || !companyName.trim()}
                  className="rounded-full px-8 h-12 font-bold bg-primary hover:bg-primary/90 shadow-lg gap-2"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Enregistrer les modifications
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-muted/30 border-2 border-dashed border-primary/10">
            <CardContent className="p-10 text-center space-y-4">
              <Palette className="w-12 h-12 text-primary/30 mx-auto" />
              <div>
                <h3 className="text-lg font-bold">Identité Visuelle</h3>
                <p className="text-sm text-muted-foreground">Utilisez l'Assistant IA (bulle en bas à droite) pour modifier vos couleurs et votre logo en temps réel.</p>
              </div>
              <div className="flex justify-center gap-2">
                <Badge variant="secondary" className="font-bold uppercase text-[9px]">LOGO AUTOMATIQUE</Badge>
                <Badge variant="secondary" className="font-bold uppercase text-[9px]">THEME IA</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
