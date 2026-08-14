export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4 text-center">
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-6xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-600 text-transparent bg-clip-text">
          PurpleIPO
        </h1>
        <p className="text-xl text-gray-400">
          We are currently undergoing a massive system upgrade and architecture overhaul.
        </p>
        <p className="text-2xl font-semibold mt-8">
          We&apos;ll be back soon.
        </p>
        <div className="pt-10">
          <div className="w-16 h-1 bg-purple-600 mx-auto rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
