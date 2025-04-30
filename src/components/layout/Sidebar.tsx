import ListIcon from '@mui/icons-material/List';
import StorageIcon from '@mui/icons-material/Storage';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import MemoryIcon from '@mui/icons-material/Memory';
import LiveHelpIcon from '@mui/icons-material/LiveHelp';

const navItems = [
  {
    title: 'Knowledge Gaps',
    path: '/knowledge-gaps',
    icon: <LiveHelpIcon />,
    roles: ['admin', 'researcher']
  },
]; 