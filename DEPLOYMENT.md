# Deploy E-Dorji

The project includes a Docker production image and a Render Blueprint configured for the free web-service plan. The production server serves the built React/Vite pages and API together; SQLite stores accounts, orders, uploaded photos, and other customer data.

## Before publishing

- Push this project to a GitHub repository you control.
- Create a Render account and connect that repository.
- Choose a strong, unique value for `E_DORJI_ADMIN_PASSWORD` and provide the admin email when Render prompts for the two secret values.
- The included Render setup uses a Singapore region and Render's free web service. Render assigns a free `onrender.com` address. You can connect a domain you already own; buying a domain is separate.
- This is suitable for a showcase, not for storing real customer data. Free Render services sleep after 15 idle minutes, may take about a minute to wake, and have an ephemeral filesystem. The SQLite database and uploaded photos can be erased whenever the service restarts, sleeps, or redeploys. [Render free-service limits](https://render.com/docs/free)
- The Render Blueprint enables the public quick-demo buttons. Anyone can open the admin demo and make admin-level changes, so do not put real customer data on it. Set `E_DORJI_ENABLE_DEMO_ACCOUNTS` to `false` in Render to disable public demo access.

## Deploy with Render

1. In Render, open the **New** menu, choose **Blueprint**, and select the GitHub repository.
2. Render reads `render.yaml`. Enter `E_DORJI_ADMIN_EMAIL` and a strong `E_DORJI_ADMIN_PASSWORD` when prompted.
3. Review the free service configuration, then create the Blueprint.
4. Wait for the Docker build and deploy to finish. Render provides an `onrender.com` address for the site.
5. Open the site and sign in with the admin email and password you configured. Add your own domain from service settings if you have one and configure its DNS as Render directs.

Free service usage is subject to Render's monthly included instance hours, bandwidth, and build limits. Review current limits before publishing.

## Deploy with another Docker host

Build and run the included `Dockerfile` on a host that supports persistent volumes. For durable customer data, mount a persistent volume at `/var/data`, expose port `10000`, and set these environment variables:

- `NODE_ENV=production`
- `PORT=10000`
- `E_DORJI_DB_PATH=/var/data/e-dorji.sqlite`
- `E_DORJI_ADMIN_NAME`
- `E_DORJI_ADMIN_EMAIL`
- `E_DORJI_ADMIN_PASSWORD`

Set `E_DORJI_ENABLE_DEMO_ACCOUNTS=true` only if you intend to expose the quick-demo sign-ins publicly. The admin demo grants full administrator access. Demo endpoints are disabled in production by default.

On an ephemeral-only filesystem, user accounts, orders, and uploaded photos are lost when the instance is replaced or restarted.
