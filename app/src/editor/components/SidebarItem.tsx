import { FC, ReactNode } from 'react';

interface SidebarItemProps {
  title: string;
  isActive: boolean;
  icon: ReactNode;
  onClick: () => void;
}

const SidebarItem: FC<SidebarItemProps> = ({ title, isActive, icon, onClick }) => {
  return (
    <>
      <div 
        className={`mb-2 cursor-pointer rounded-lg p-3 transition-colors w-20 ${
          isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
        }`}
        onClick={onClick}
      >
        <div className="flex flex-col items-center gap-2">
          {icon}
          <h3 className={`text-sm text-center break-words w-full ${isActive ? 'text-blue-600' : 'text-gray-700'}`}>
            {title}
          </h3>
        </div>
      </div>
      <div className="mb-2 border-b border-gray-200"></div>
    </>
  );
};

export default SidebarItem; 