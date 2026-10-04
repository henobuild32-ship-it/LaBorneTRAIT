'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Video, Plus, ExternalLink, Calendar as CalendarIcon, Clock, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { VideoConferenceInfo } from '@/lib/types';

type ClassItem = { id: string; name: string };

export default function AdminConferences() {
  const { user } = useAppStore();
  const [conferences, setConferences] = useState<VideoConferenceInfo[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    targetRole: 'ALL',
    targetClassId: '',
  });

  const fetchClasses = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const res = await fetch(`/api/classes?schoolId=${user.schoolId}`);
      if (!res.ok) return;
      const data = await res.json();
      setClasses(Array.isArray(data.classes) ? data.classes : []);
    } catch {
      toast.error("Erreur lors du chargement des classes");
    }
  }, [user?.schoolId]);

  const fetchConferences = useCallback(async () => {
    if (!user?.schoolId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/conferences?schoolId=${user.schoolId}`);
      if (res.ok) {
        const data = await res.json();
        setConferences(data.conferences);
      } else {
        toast.error("Erreur lors du chargement des visioconférences");
      }
    } catch (error) {
      toast.error("Erreur de connexion");
    } finally {
      setIsLoading(false);
    }
  }, [user?.schoolId]);

  useEffect(() => {
    fetchConferences();
    fetchClasses();
  }, [fetchConferences, fetchClasses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    if (formData.targetRole === 'CLASS' && !formData.targetClassId) {
      toast.error("Veuillez sélectionner une classe");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/conferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          schoolId: user.schoolId,
          creatorId: user.id,
          targetClassId: formData.targetRole === 'CLASS' ? formData.targetClassId : '',
        }),
      });

      if (res.ok) {
        toast.success("Visioconférence programmée avec succès");
        toast.info("Une notification a été envoyée aux utilisateurs concernés", {
          icon: <Users className="w-4 h-4" />
        });
        setIsDialogOpen(false);
        setFormData({
          title: '',
          description: '',
          date: '',
          time: '',
          targetRole: 'ALL',
          targetClassId: '',
        });
        fetchConferences();
      } else {
        toast.error("Erreur lors de la programmation");
      }
    } catch (error) {
      toast.error("Erreur de connexion");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment annuler cette visioconférence ?")) return;
    
    try {
      const res = await fetch(`/api/conferences?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success("Visioconférence annulée");
        setConferences(conferences.filter(c => c.id !== id));
      } else {
        toast.error("Erreur lors de l'annulation");
      }
    } catch (error) {
      toast.error("Erreur de connexion");
    }
  };

  const roleLabels: Record<string, string> = {
    'ALL': 'Tous',
    'TEACHER': 'Professeurs',
    'STUDENT': 'Élèves',
    'PARENT': 'Parents',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Visioconférences</h2>
          <p className="text-muted-foreground">Gérez et planifiez des réunions virtuelles avec Jitsi Meet.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Programmer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Programmer une visioconférence</DialogTitle>
                <DialogDescription>
                  Un lien sécurisé sera généré automatiquement et envoyé par notification aux participants.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titre de la réunion <span className="text-red-500">*</span></Label>
                  <Input 
                    id="title" 
                    required 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="Ex: Réunion Parents-Professeurs" 
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date <span className="text-red-500">*</span></Label>
                    <Input 
                      id="date" 
                      type="date" 
                      required 
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Heure <span className="text-red-500">*</span></Label>
                    <Input 
                      id="time" 
                      type="time" 
                      required 
                      value={formData.time}
                      onChange={e => setFormData({...formData, time: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetRole">Audience cible</Label>
                  <Select 
                    value={formData.targetRole}
                      onValueChange={val => setFormData({ ...formData, targetRole: val, targetClassId: val === 'CLASS' ? formData.targetClassId : '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez l'audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tous les utilisateurs</SelectItem>
                      <SelectItem value="TEACHER">Professeurs uniquement</SelectItem>
                      <SelectItem value="PARENT">Parents uniquement</SelectItem>
                      <SelectItem value="STUDENT">Élèves uniquement</SelectItem>
                      <SelectItem value="CLASS">Une classe spécifique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.targetRole === 'CLASS' && (
                  <div className="space-y-2">
                    <Label htmlFor="targetClassId">Classe</Label>
                    <Select 
                      value={formData.targetClassId}
                      onValueChange={val => setFormData({ ...formData, targetClassId: val })}
                    >
                      <SelectTrigger id="targetClassId">
                        <SelectValue placeholder="Sélectionnez une classe" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? 'Génération...' : 'Programmer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Réunions planifiées</CardTitle>
          <CardDescription>
            Liste de vos prochaines visioconférences
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Chargement...</div>
          ) : conferences.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Video className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold">Aucune visioconférence</h3>
              <p className="text-muted-foreground max-w-sm mt-1">
                Vous n'avez pas encore programmé de réunion virtuelle.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                Programmer la première
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Date & Heure</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conferences.map((conf) => (
                    <TableRow key={conf.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="truncate max-w-[200px]">{conf.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                            {conf.date}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {conf.time}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {roleLabels[conf.targetRole] || conf.targetRole}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                            onClick={() => window.open(conf.roomUrl, '_blank')}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Rejoindre
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(conf.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
