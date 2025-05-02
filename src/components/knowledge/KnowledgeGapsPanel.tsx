import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  Divider,
  List,
  ListItem,
  ListItemText,
  Grid,
  CircularProgress,
  TextField,
  MenuItem,
  Select,
  SelectChangeEvent,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Interface definitions matching the backend
interface KnowledgeGap {
  id: string;
  topic: string;
  description: string;
  confidence: number; 
  frequency: number;
  importance: number;
  suggestedActions: string[];
  relatedQueries: string[];
  category: string;
  status: 'new' | 'investigating' | 'addressed' | 'dismissed';
  createdAt: string;
  updatedAt: string;
}

interface LearningPriority {
  id: string;
  knowledgeGapId: string;
  score: number;
  reasoning: string;
  suggestedSources: string[];
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeGapsStats {
  totalGaps: number;
  activeGaps: number;
  addressedGaps: number;
  byCategory: Record<string, number>;
  topPriorities: Array<{id: string, topic: string, score: number}>;
}

const statusColors = {
  new: 'primary',
  investigating: 'warning',
  addressed: 'success',
  dismissed: 'error',
  pending: 'default',
  in_progress: 'info',
  completed: 'success'
};

const KnowledgeGapsPanel: React.FC = () => {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [priorities, setPriorities] = useState<LearningPriority[]>([]);
  const [stats, setStats] = useState<KnowledgeGapsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conversation, setConversation] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Load gaps on component mount
  useEffect(() => {
    fetchKnowledgeGaps();
  }, []);

  // Fetch knowledge gaps from API
  const fetchKnowledgeGaps = async () => {
    setLoading(true);
    try {
      let url = '/api/knowledge/gaps';
      
      // Add filters if specified
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (statusFilter) params.append('status', statusFilter);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch knowledge gaps');
      }
      
      const data = await response.json();
      setGaps(data.gaps || []);
      setStats(data.stats || null);
      
      // Fetch priorities for each gap
      const allPriorities: LearningPriority[] = [];
      for (const gap of data.gaps || []) {
        const prioritiesResponse = await fetch(`/api/knowledge/gaps?gapId=${gap.id}`);
        if (prioritiesResponse.ok) {
          const prioritiesData = await prioritiesResponse.json();
          if (prioritiesData.priorities) {
            allPriorities.push(...prioritiesData.priorities);
          }
        }
      }
      
      setPriorities(allPriorities);
    } catch (err) {
      console.error('Error fetching knowledge gaps:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Analyze conversation for knowledge gaps
  const analyzeConversation = async () => {
    if (!conversation.trim()) return;
    
    setAnalyzing(true);
    try {
      const response = await fetch('/api/knowledge/gaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversation,
          threshold: 0.6, // Default confidence threshold
          maxGaps: 5 // Maximum gaps to identify
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze conversation');
      }
      
      const data = await response.json();
      
      // Update state with new gaps and priorities
      setGaps(prev => {
        const existingIds = new Set(prev.map(g => g.id));
        const newGaps = data.gaps.filter((g: KnowledgeGap) => !existingIds.has(g.id));
        return [...prev, ...newGaps];
      });
      
      setPriorities(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPriorities = data.priorities.filter((p: LearningPriority) => !existingIds.has(p.id));
        return [...prev, ...newPriorities];
      });
      
      // Clear the conversation input
      setConversation('');
      
      // Refresh to get updated stats
      fetchKnowledgeGaps();
    } catch (err) {
      console.error('Error analyzing conversation:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAnalyzing(false);
    }
  };

  // Update status of a knowledge gap
  const updateGapStatus = async (gapId: string, status: 'new' | 'investigating' | 'addressed' | 'dismissed') => {
    try {
      const response = await fetch('/api/knowledge/gaps', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: gapId,
          type: 'gap',
          status
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update gap status');
      }
      
      // Update local state
      setGaps(prev => prev.map(g => g.id === gapId ? { ...g, status } : g));
      
      // Refresh to get updated stats and priorities
      fetchKnowledgeGaps();
    } catch (err) {
      console.error('Error updating gap status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Update status of a learning priority
  const updatePriorityStatus = async (priorityId: string, status: 'pending' | 'in_progress' | 'completed') => {
    try {
      const response = await fetch('/api/knowledge/gaps', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: priorityId,
          type: 'priority',
          status
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update priority status');
      }
      
      // Update local state
      setPriorities(prev => prev.map(p => p.id === priorityId ? { ...p, status } : p));
      
      // Refresh to get updated stats and gaps
      fetchKnowledgeGaps();
    } catch (err) {
      console.error('Error updating priority status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Get priorities for a specific gap
  const getPrioritiesForGap = (gapId: string) => {
    return priorities.filter(p => p.knowledgeGapId === gapId);
  };

  // Helper to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Render a knowledge gap card
  const renderGapCard = (gap: KnowledgeGap) => {
    const gapPriorities = getPrioritiesForGap(gap.id);
    
    return (
      <Card key={gap.id} sx={{ mb: 2, borderLeft: `5px solid ${getStatusColor(gap.status)}` }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="h6">{gap.topic}</Typography>
            <Chip 
              label={gap.status} 
              color={statusColors[gap.status] as any} 
              size="small" 
            />
          </Box>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {gap.category} • Importance: {gap.importance}/10 • Frequency: {gap.frequency}
          </Typography>
          
          <Typography variant="body1" paragraph>
            {gap.description}
          </Typography>
          
          {gap.suggestedActions.length > 0 && (
            <>
              <Typography variant="subtitle2">Suggested Actions:</Typography>
              <List dense>
                {gap.suggestedActions.map((action, i) => (
                  <ListItem key={i}>
                    <ListItemText primary={action} />
                  </ListItem>
                ))}
              </List>
            </>
          )}
          
          {gapPriorities.length > 0 && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Learning Priorities</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {gapPriorities.map(priority => (
                  <Box key={priority.id} mb={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2">
                        Priority Score: {priority.score.toFixed(1)}/10
                      </Typography>
                      <Chip 
                        label={priority.status} 
                        color={statusColors[priority.status] as any} 
                        size="small" 
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary">
                      {priority.reasoning}
                    </Typography>
                    
                    {priority.suggestedSources.length > 0 && (
                      <>
                        <Typography variant="subtitle2" mt={1}>Suggested Resources:</Typography>
                        <List dense>
                          {priority.suggestedSources.map((source, i) => (
                            <ListItem key={i}>
                              <ListItemText primary={source} />
                            </ListItem>
                          ))}
                        </List>
                      </>
                    )}
                    
                    <Box mt={1}>
                      <Button 
                        size="small" 
                        variant={priority.status === 'pending' ? 'contained' : 'outlined'}
                        color="primary" 
                        onClick={() => updatePriorityStatus(priority.id, 'pending')}
                        disabled={priority.status === 'pending'}
                      >
                        Pending
                      </Button>
                      <Button 
                        size="small" 
                        variant={priority.status === 'in_progress' ? 'contained' : 'outlined'}
                        color="warning" 
                        onClick={() => updatePriorityStatus(priority.id, 'in_progress')}
                        disabled={priority.status === 'in_progress'}
                        sx={{ mx: 1 }}
                      >
                        In Progress
                      </Button>
                      <Button 
                        size="small" 
                        variant={priority.status === 'completed' ? 'contained' : 'outlined'}
                        color="success" 
                        onClick={() => updatePriorityStatus(priority.id, 'completed')}
                        disabled={priority.status === 'completed'}
                      >
                        Completed
                      </Button>
                    </Box>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          )}
          
          <Divider sx={{ my: 2 }} />
          
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption">
              Created: {formatDate(gap.createdAt)} • Updated: {formatDate(gap.updatedAt)}
            </Typography>
            
            <Box>
              <Button 
                size="small" 
                variant={gap.status === 'new' ? 'contained' : 'outlined'}
                color="primary" 
                onClick={() => updateGapStatus(gap.id, 'new')}
                disabled={gap.status === 'new'}
              >
                New
              </Button>
              <Button 
                size="small" 
                variant={gap.status === 'investigating' ? 'contained' : 'outlined'}
                color="warning" 
                onClick={() => updateGapStatus(gap.id, 'investigating')}
                disabled={gap.status === 'investigating'}
                sx={{ mx: 1 }}
              >
                Investigating
              </Button>
              <Button 
                size="small" 
                variant={gap.status === 'addressed' ? 'contained' : 'outlined'}
                color="success" 
                onClick={() => updateGapStatus(gap.id, 'addressed')}
                disabled={gap.status === 'addressed'}
                sx={{ mr: 1 }}
              >
                Addressed
              </Button>
              <Button 
                size="small" 
                variant={gap.status === 'dismissed' ? 'contained' : 'outlined'}
                color="error" 
                onClick={() => updateGapStatus(gap.id, 'dismissed')}
                disabled={gap.status === 'dismissed'}
              >
                Dismiss
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // Helper to get color for status
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      new: '#2196f3',
      investigating: '#ff9800',
      addressed: '#4caf50',
      dismissed: '#f44336'
    };
    return colorMap[status] || '#9e9e9e';
  };

  // Render statistics section
  const renderStats = () => {
    if (!stats) return null;
    
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Knowledge Gaps Statistics</Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: '1 1 calc(33.33% - 16px)', minWidth: '250px', textAlign: 'center' }}>
              <Typography variant="h3">{stats.totalGaps}</Typography>
              <Typography variant="subtitle1">Total Gaps</Typography>
            </Box>
            <Box sx={{ flex: '1 1 calc(33.33% - 16px)', minWidth: '250px', textAlign: 'center' }}>
              <Typography variant="h3">{stats.activeGaps}</Typography>
              <Typography variant="subtitle1">Active Gaps</Typography>
            </Box>
            <Box sx={{ flex: '1 1 calc(33.33% - 16px)', minWidth: '250px', textAlign: 'center' }}>
              <Typography variant="h3">{stats.addressedGaps}</Typography>
              <Typography variant="subtitle1">Addressed Gaps</Typography>
            </Box>
          </Box>
          
          <Typography variant="subtitle2" mt={3} mb={1}>Categories:</Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {Object.entries(stats.byCategory).map(([category, count]) => (
              <Chip 
                key={category} 
                label={`${category}: ${count}`} 
                variant="outlined" 
                onClick={() => setCategoryFilter(category === categoryFilter ? '' : category)}
                color={category === categoryFilter ? 'primary' : 'default'}
              />
            ))}
          </Box>
          
          {stats.topPriorities.length > 0 && (
            <>
              <Typography variant="subtitle2" mt={3} mb={1}>Top Learning Priorities:</Typography>
              <List dense>
                {stats.topPriorities.map(priority => (
                  <ListItem key={priority.id}>
                    <ListItemText 
                      primary={priority.topic} 
                      secondary={`Priority Score: ${priority.score.toFixed(1)}/10`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Knowledge Gaps</Typography>
      
      {error && (
        <Box sx={{ mb: 2, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}
      
      {/* Analysis Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Analyze Conversation for Knowledge Gaps</Typography>
          
          <TextField
            label="Paste conversation to analyze"
            multiline
            rows={4}
            fullWidth
            value={conversation}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConversation(e.target.value)}
            variant="outlined"
            margin="normal"
            disabled={analyzing}
          />
          
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button
              variant="contained"
              onClick={analyzeConversation}
              disabled={!conversation.trim() || analyzing}
              startIcon={analyzing ? <CircularProgress size={20} /> : null}
            >
              {analyzing ? 'Analyzing...' : 'Analyze for Knowledge Gaps'}
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      {/* Stats Section */}
      {renderStats()}
      
      {/* Filters */}
      <Box display="flex" gap={2} mb={3}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Category</InputLabel>
          <Select
            value={categoryFilter}
            label="Filter by Category"
            onChange={(e: SelectChangeEvent) => setCategoryFilter(e.target.value)}
          >
            <MenuItem value="">All Categories</MenuItem>
            {stats && Object.keys(stats.byCategory).map(category => (
              <MenuItem key={category} value={category}>{category}</MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Status</InputLabel>
          <Select
            value={statusFilter}
            label="Filter by Status"
            onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="new">New</MenuItem>
            <MenuItem value="investigating">Investigating</MenuItem>
            <MenuItem value="addressed">Addressed</MenuItem>
            <MenuItem value="dismissed">Dismissed</MenuItem>
          </Select>
        </FormControl>
        
        <Button variant="outlined" onClick={fetchKnowledgeGaps}>
          Apply Filters
        </Button>
      </Box>
      
      {/* Knowledge Gaps List */}
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
        </Box>
      ) : gaps.length === 0 ? (
        <Typography variant="subtitle1" align="center">
          No knowledge gaps found. Analyze some conversations to identify gaps.
        </Typography>
      ) : (
        <Box>
          {gaps.map((gap) => (
            <React.Fragment key={gap.id}>
              {renderGapCard(gap)}
            </React.Fragment>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default KnowledgeGapsPanel; 