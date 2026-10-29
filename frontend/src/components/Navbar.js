import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MenuIcon from '@mui/icons-material/Menu';
import { NavLink, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/authContext';

// Every link once, with the roles that see it. Groups keep this order; links keep their order within a group.
const LINKS = [
  { to: '/', label: 'Dashboard', roles: ['admin'] },
  { to: '/', label: 'Home', roles: ['manager', 'employee'] },
  { to: '/', label: 'Organisations', roles: ['superadmin'] },
  { group: 'Organisation', to: '/org-structure', label: 'Org structure', roles: ['admin'] },
  { group: 'Organisation', to: '/org-units', label: 'Org units', roles: ['admin', 'manager', 'employee'] },
  { group: 'Organisation', to: '/job-roles', label: 'Job roles', roles: ['admin', 'manager', 'employee'] },
  { group: 'Organisation', to: '/people', label: 'People', roles: ['admin'] },
  { group: 'Skills', to: '/my-skills', label: 'My skills', roles: ['manager', 'employee'] },
  { group: 'Skills', to: '/skills', label: 'Skills', roles: ['admin', 'manager', 'employee'] },
  { group: 'Skills', to: '/questionnaires', label: 'Questionnaires', roles: ['admin', 'manager', 'employee'] },
  { group: 'Skills', to: '/ratings', label: 'Ratings', roles: ['admin'] },
  { group: 'Skills', to: '/ratings', label: 'Staff ratings', roles: ['manager'] },
  { group: 'Training', to: '/my-training', label: 'My training', roles: ['manager', 'employee'] },
  { group: 'Training', to: '/training-plans', label: 'Training plan', roles: ['admin', 'manager'] },
  { group: 'Reports', to: '/reports/tna', label: 'TNA report', roles: ['admin', 'manager'] },
  { group: 'Admin', to: '/classification', label: 'Classification', roles: ['admin'] },
  { group: 'Admin', to: '/imports', label: 'Import', roles: ['admin'] },
  { group: 'Admin', to: '/license', label: 'Licence', roles: ['admin'] },
];

// Detail pages that belong to a link without sharing its path prefix.
const ALSO_ACTIVE = { '/training-plans': ['/training-programmes'] };

const ROLE_LABELS = { superadmin: 'Super admin', admin: 'Admin', manager: 'Manager', employee: 'Employee' };

// Top-level entries for a role: plain links, and groups of links. Groups with no links for the role are left out.
export function navFor(role) {
  const entries = [];
  LINKS.filter((link) => link.roles.includes(role)).forEach((link) => {
    if (!link.group) {
      entries.push({ link });
      return;
    }
    const group = entries.find((entry) => entry.label === link.group);
    if (group) group.links.push(link);
    else entries.push({ label: link.group, links: [link] });
  });
  return entries;
}

function isActive(link, pathname) {
  if (link.to === '/') return pathname === '/';
  return [link.to, ...(ALSO_ACTIVE[link.to] || [])].some((path) => matchPath({ path, end: false }, pathname));
}

const ACTIVE_BG = 'rgba(255,255,255,0.15)';

function GroupMenu({ label, links, pathname }) {
  const [anchor, setAnchor] = React.useState(null);
  const active = links.some((link) => isActive(link, pathname));
  const id = `nav-${label.toLowerCase()}`;
  return (
    <>
      <Button
        color="inherit"
        aria-controls={anchor ? id : undefined}
        aria-haspopup="true"
        aria-expanded={anchor ? 'true' : undefined}
        endIcon={<KeyboardArrowDownIcon />}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={active ? { bgcolor: ACTIVE_BG } : undefined}
      >
        {label}
      </Button>
      <Menu id={id} anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {links.map((link) => (
          <MenuItem
            key={link.label}
            component={NavLink}
            to={link.to}
            selected={isActive(link, pathname)}
            onClick={() => setAnchor(null)}
          >
            {link.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function NavDrawer({ open, onClose, entries, pathname }) {
  const item = (link, nested) => (
    <ListItemButton
      key={`${link.to}-${link.label}`}
      component={NavLink}
      to={link.to}
      end={link.to === '/'}
      selected={isActive(link, pathname)}
      onClick={onClose}
      sx={nested ? { pl: 3 } : undefined}
    >
      <ListItemText primary={link.label} />
    </ListItemButton>
  );
  return (
    <Drawer open={open} onClose={onClose}>
      <Box sx={{ width: 260 }} role="navigation" aria-label="Main menu">
        {entries.map((entry) => (entry.link ? (
          <List key={entry.link.label} dense>{item(entry.link)}</List>
        ) : (
          <React.Fragment key={entry.label}>
            <Divider />
            <List dense subheader={<ListSubheader>{entry.label}</ListSubheader>}>
              {entry.links.map((link) => item(link, true))}
            </List>
          </React.Fragment>
        )))}
      </Box>
    </Drawer>
  );
}

export default function Navbar() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const entries = role ? navFor(role) : [];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <AppBar position="static">
      <Toolbar sx={{ gap: 1 }}>
        {narrow && entries.length > 0 && (
          <IconButton color="inherit" edge="start" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
        )}
        <Typography variant="h6" component="div" sx={{ cursor: 'pointer', mr: 2 }} onClick={() => navigate('/')}>
          LSMS
        </Typography>
        <Box sx={{ flexGrow: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {!narrow && entries.map((entry) => (entry.link ? (
            <Button
              key={entry.link.label}
              component={NavLink}
              to={entry.link.to}
              end={entry.link.to === '/'}
              color="inherit"
              sx={{ '&.active': { bgcolor: ACTIVE_BG } }}
            >
              {entry.link.label}
            </Button>
          ) : (
            <GroupMenu key={entry.label} label={entry.label} links={entry.links} pathname={pathname} />
          )))}
        </Box>
        {user ? (
          <>
            {!narrow && <Typography variant="body1">{user.username}</Typography>}
            <Chip size="small" label={ROLE_LABELS[role]} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }} />
            <Button color="inherit" onClick={handleLogout}>Logout</Button>
          </>
        ) : (
          <Button color="inherit" onClick={() => navigate('/login')}>Login</Button>
        )}
      </Toolbar>
      {narrow && <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} entries={entries} pathname={pathname} />}
    </AppBar>
  );
}
