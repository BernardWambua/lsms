import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate, useLocation  } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();
  const [username, setUsername] = React.useState(() => sessionStorage.getItem('username') || '');
  const navigate = useNavigate();


  React.useEffect(() => {
    setUsername(sessionStorage.getItem('username') || '');
  }, [location]);

  // Handle logout
  const handleLogout = () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('username');
    setUsername('');
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Home
          </Typography>
          {username ? (
            <>
              <Typography variant="body1" sx={{ mr: 2 }}>
                {username}
              </Typography>
              <Button color="inherit" onClick={handleLogout}>Logout</Button>
            </>
          ) : (
            <>
              <Button color="inherit" onClick={() => navigate('/login')}>Login</Button>
              <Button color="inherit" onClick={() => navigate('/signup')}>Sign Up</Button>
            </>
          )}
        </Toolbar>
      </AppBar>
    </Box>
  );
}
