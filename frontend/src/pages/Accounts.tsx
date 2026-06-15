import { useEffect, useState } from "react";
import { PLATFORMS } from "../assets/assets";
import { PlusIcon } from "lucide-react";
import AccountsList from "../components/AccountsList";
import PlatformPickerModal from "../components/PlatformPickerModal";
import api from "../api/axios";
import { ENDPOINTS } from "../api/config";

type AccountLike = { _id: string; platform: string };

const Accounts = () => {
  const [accounts, setAccounts] = useState<AccountLike[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);

  type AxiosLikeError = {
    response?: { data?: { message?: string } };
    message?: string;
  };

  const fetchAccounts = async (isSync = false, platform?: string | null) => {
    try {
      if (isSync) {
        const label = platform
          ? platform.charAt(0).toUpperCase() + platform.slice(1)
          : "Social Media";
        await api.get(ENDPOINTS.accounts.oauthSync);
        console.log(`${label} account synced successfully`);
      }

      const cacheBuster = Date.now();
      const { data } = await api.get(
        `${ENDPOINTS.accounts.base}?_=${cacheBuster}`,
        {
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
      );
      setAccounts(data);
    } catch (error: unknown) {
      const err = error as AxiosLikeError;
      console.log(
        err?.response?.data?.message ||
          err?.message ||
          "Error fetching accounts",
      );
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedPlatform = params.get("connected");
    const connectedUsername = params.get("username");
    const syncNeeded = params.get("sync") === "true";
    const errorMsg = params.get("error");

    window.history.replaceState({}, document.title, window.location.pathname);

    if (connectedPlatform) {
      const label =
        connectedPlatform.charAt(0).toUpperCase() + connectedPlatform.slice(1);
      const handle = connectedUsername ? `(@${connectedUsername})` : "";

      setTimeout(() => {
        void fetchAccounts(true, connectedPlatform);
      }, 0);

      console.log(`${label} account ${handle} connected successfully`);
    } else if (errorMsg) {
      console.error(`Error connecting account: ${errorMsg}`);
    } else if (syncNeeded) {
      setTimeout(() => {
        void fetchAccounts(true, null);
      }, 0);
    } else {
      setTimeout(() => {
        void fetchAccounts();
      }, 0);
    }
  }, []);

  const handleConnect = async (platformId: string) => {
    setConnecting(platformId);
    try {
      const { data } = await api.get(ENDPOINTS.accounts.oauthUrl(platformId));
      window.location.href = data.url;
      setConnecting(null);
    } catch (error: unknown) {
      const err = error as AxiosLikeError;
      console.log(
        err?.response?.data?.message ||
          err?.message ||
          "Error connecting account",
      );
      setConnecting(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      await api.delete(ENDPOINTS.accounts.disconnect(accountId));

      console.log("Account disconnected successfully");

      await fetchAccounts();
    } catch (error: any) {
      console.error(
        error?.response?.data?.message ||
          error?.message ||
          "Error disconnecting account",
      );
    }
  };

  const connectedIds = accounts.map((a) => a.platform);

  return (
    <>
      {showPlatformPicker && (
        <PlatformPickerModal
          connectedIds={connectedIds}
          connecting={connecting}
          onClose={() => setShowPlatformPicker(false)}
          onConnect={handleConnect}
        />
      )}

      <div className="space-y-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm">
          <div>
            <h2 className="text-xl text-slate-900">Connected Accounts</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {accounts.length} of {PLATFORMS.length} platforms connected
            </p>
          </div>
          <button
            onClick={() => setShowPlatformPicker(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-all w-full sm:w-auto justify-center"
          >
            <PlusIcon className="size-4" /> Connect Account
          </button>
        </div>

        <AccountsList accounts={accounts} onDisconnect={handleDisconnect} />
      </div>
    </>
  );
};

export default Accounts;
